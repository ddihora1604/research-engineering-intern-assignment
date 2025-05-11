from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import json
import pandas as pd
from datetime import datetime
import networkx as nx
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import os
import numpy as np
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

app = Flask(__name__)
CORS(app)

# Global variable to store the loaded data
data = None
# Initialize tokenizer and model for summarization
try:
    tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-small")
    model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-small")
except:
    tokenizer = None
    model = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    global data
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and file.filename.endswith('.jsonl'):
        # Read JSONL file
        data = pd.read_json(file, lines=True)
        # Normalize the nested JSON structure
        data = pd.json_normalize(data['data'])
        # Convert created_utc to datetime
        data['created_utc'] = pd.to_datetime(data['created_utc'], unit='s')
        print("DataFrame columns:", data.columns)  # Debug line
        return jsonify({'message': 'File uploaded successfully', 'rows': len(data)})
    return jsonify({'error': 'Invalid file format'}), 400

@app.route('/api/timeseries', methods=['GET'])
def get_timeseries():
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    query = request.args.get('query', '')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    # Filter data based on query and date range
    filtered_data = data[data['selftext'].str.contains(query, case=False, na=False) | 
                          data['title'].str.contains(query, case=False, na=False)]
    if start_date and end_date:
        start_date = pd.to_datetime(start_date)
        end_date = pd.to_datetime(end_date)
        filtered_data = filtered_data[
            (filtered_data['created_utc'] >= start_date) & 
            (filtered_data['created_utc'] <= end_date)
        ]
    
    # Group by date and count posts
    timeseries = filtered_data.groupby(filtered_data['created_utc'].dt.date).size().reset_index()
    timeseries.columns = ['date', 'count']
    
    return jsonify(timeseries.to_dict('records'))

@app.route('/api/top_contributors', methods=['GET'])
def get_top_contributors():
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    query = request.args.get('query', '')
    limit = int(request.args.get('limit', 10))
    
    filtered_data = data[data['selftext'].str.contains(query, case=False, na=False) | 
                          data['title'].str.contains(query, case=False, na=False)]
    top_users = filtered_data['author'].value_counts().head(limit).reset_index()
    top_users.columns = ['author', 'count']
    
    return jsonify(top_users.to_dict('records'))

@app.route('/api/network', methods=['GET'])
def get_network():
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    query = request.args.get('query', '')
    
    # Create a directed graph
    G = nx.DiGraph()
    
    # Filter data
    filtered_data = data[
        data['selftext'].str.contains(query, case=False, na=False) |
        data['title'].str.contains(query, case=False, na=False)
    ]
    
    # Add nodes for all authors
    author_counts = filtered_data['author'].value_counts()
    for author, count in author_counts.items():
        G.add_node(author, size=min(count*3, 30), posts=int(count))
    
    # Add edges based on interactions (comments)
    comment_edges = []
    for idx, row in filtered_data.iterrows():
        if pd.notna(row.get('parent_id')) and row.get('parent_id', '').startswith('t3_'):
            parent_post = filtered_data[filtered_data['id'] == row.get('parent_id')[3:]]
            if not parent_post.empty:
                parent_author = parent_post.iloc[0]['author']
                if parent_author != row['author']:  # Don't count self-interactions
                    comment_edges.append((row['author'], parent_author))
    
    # Count edge weights
    edge_weights = {}
    for source, target in comment_edges:
        if (source, target) not in edge_weights:
            edge_weights[(source, target)] = 0
        edge_weights[(source, target)] += 1
    
    # Add weighted edges
    for (source, target), weight in edge_weights.items():
        G.add_edge(source, target, weight=weight)
    
    # Find communities using Louvain method
    if len(G.nodes()) > 0:
        try:
            import community as community_louvain
            partition = community_louvain.best_partition(G.to_undirected())
            nx.set_node_attributes(G, partition, 'group')
        except:
            # Fallback if community detection fails
            for node in G.nodes():
                G.nodes[node]['group'] = 0
    
    # Convert to D3.js format
    nodes = [{'id': node, 'size': G.nodes[node].get('size', 10), 
              'group': G.nodes[node].get('group', 0),
              'posts': G.nodes[node].get('posts', 1)} 
             for node in G.nodes()]
    links = [{'source': source, 'target': target, 'weight': G.edges[source, target].get('weight', 1)} 
             for source, target in G.edges()]
    
    return jsonify({'nodes': nodes, 'links': links})

@app.route('/api/topics', methods=['GET'])
def get_topics():
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    n_topics = int(request.args.get('n_topics', 5))
    query = request.args.get('query', '')
    
    # Filter data if query is provided
    filtered_data = data
    if query:
        filtered_data = data[
            data['selftext'].str.contains(query, case=False, na=False) |
            data['title'].str.contains(query, case=False, na=False)
        ]
    
    # Prepare text data - combine title and selftext for better topic detection
    filtered_data['combined_text'] = filtered_data['title'] + ' ' + filtered_data['selftext'].fillna('')
    
    # Prepare text data
    vectorizer = CountVectorizer(max_df=0.95, min_df=2, stop_words='english')
    X = vectorizer.fit_transform(filtered_data['combined_text'])
    
    # Apply LDA
    lda = LatentDirichletAllocation(n_components=n_topics, random_state=42)
    lda.fit(X)
    
    # Get top words for each topic
    feature_names = vectorizer.get_feature_names_out()
    topics = []
    for topic_idx, topic in enumerate(lda.components_):
        top_words = [feature_names[i] for i in topic.argsort()[:-10-1:-1]]
        topics.append({
            'topic_id': topic_idx,
            'top_words': top_words
        })
    
    return jsonify(topics)

@app.route('/api/coordinated', methods=['GET'])
def get_coordinated_behavior():
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    time_window = int(request.args.get('time_window', 3600))  # Default to 1 hour in seconds
    similarity_threshold = float(request.args.get('similarity_threshold', 0.7))
    
    # Step 1: Sort data by timestamp
    sorted_data = data.sort_values('created_utc')
    
    # Step 2: Find posts with similar content in close time periods
    coordinated_groups = []
    processed_indices = set()
    
    for i, row1 in sorted_data.iterrows():
        if i in processed_indices:
            continue
            
        group = [{'author': row1['author'], 'id': row1.get('id', ''), 
                 'created_utc': row1['created_utc'], 'title': row1['title'],
                 'url': f"https://reddit.com/{row1.get('permalink', '')}"}]
        
        # Look for similar posts in the time window
        time_limit = row1['created_utc'] + pd.Timedelta(seconds=time_window)
        
        for j, row2 in sorted_data.loc[sorted_data['created_utc'] <= time_limit].iterrows():
            if i == j or j in processed_indices:
                continue
                
            # Check title similarity (simple approach for demonstration)
            # In a production system, use more sophisticated text similarity
            title1 = row1['title'].lower()
            title2 = row2['title'].lower()
            
            # Simple similarity: percentage of words in common
            words1 = set(title1.split())
            words2 = set(title2.split())
            if len(words1) == 0 or len(words2) == 0:
                continue
                
            similarity = len(words1.intersection(words2)) / max(len(words1), len(words2))
            
            if similarity >= similarity_threshold:
                group.append({'author': row2['author'], 'id': row2.get('id', ''),
                             'created_utc': row2['created_utc'], 'title': row2['title'],
                             'url': f"https://reddit.com/{row2.get('permalink', '')}"})
                processed_indices.add(j)
        
        if len(group) > 1:  # Only consider groups with at least 2 posts
            coordinated_groups.append(group)
            processed_indices.add(i)
    
    # Step 3: Create network of coordinated authors
    author_links = set()
    for group in coordinated_groups:
        authors = [post['author'] for post in group]
        for i in range(len(authors)):
            for j in range(i+1, len(authors)):
                if authors[i] != authors[j]:  # Avoid self-loops
                    # Store as sorted tuple to avoid duplicates
                    author_links.add(tuple(sorted([authors[i], authors[j]])))
    
    # Convert to list of dictionaries for JSON serialization
    links = [{'source': source, 'target': target} for source, target in author_links]
    
    # Collect all authors involved in coordinated behavior
    all_authors = set()
    for source, target in author_links:
        all_authors.add(source)
        all_authors.add(target)
    
    nodes = [{'id': author} for author in all_authors]
    
    return jsonify({
        'network': {'nodes': nodes, 'links': links},
        'groups': coordinated_groups,
        'total_groups': len(coordinated_groups),
        'total_authors': len(all_authors)
    })

@app.route('/api/ai_summary', methods=['GET'])
def get_ai_summary():
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    if tokenizer is None or model is None:
        return jsonify({'error': 'Summarization model not available'}), 500
    
    query = request.args.get('query', '')
    
    # Filter data based on query
    filtered_data = data[
        data['selftext'].str.contains(query, case=False, na=False) |
        data['title'].str.contains(query, case=False, na=False)
    ]
    
    if len(filtered_data) == 0:
        return jsonify({'summary': f"No data found for query: {query}"})
    
    # Get time range
    min_date = filtered_data['created_utc'].min().strftime('%Y-%m-%d')
    max_date = filtered_data['created_utc'].max().strftime('%Y-%m-%d')
    
    # Get most active subreddits
    top_subreddits = filtered_data['subreddit'].value_counts().head(3).to_dict()
    
    # Get sample of titles for summarization (limit length for model)
    sample_titles = filtered_data['title'].sample(min(10, len(filtered_data))).tolist()
    titles_text = " ".join(sample_titles)
    
    # Create a summary context
    summary_context = f"From {min_date} to {max_date}, there were {len(filtered_data)} posts about '{query}'. "
    summary_context += f"The most active subreddits were {', '.join(top_subreddits.keys())}. "
    summary_context += f"Sample post titles: {titles_text[:500]}..."
    
    # Generate summary using the model
    try:
        input_text = f"Summarize the following Reddit trends: {summary_context}"
        inputs = tokenizer(input_text, return_tensors="pt", max_length=512, truncation=True)
        outputs = model.generate(**inputs, max_length=150, min_length=40)
        summary = tokenizer.decode(outputs[0], skip_special_tokens=True)
    except Exception as e:
        # Fallback summary if model fails
        summary = f"Found {len(filtered_data)} posts about '{query}' from {min_date} to {max_date}. "
        summary += f"Most active in: {', '.join(list(top_subreddits.keys())[:3])}."
    
    # Create a metrics summary
    metrics = {
        'total_posts': len(filtered_data),
        'time_range': f"{min_date} to {max_date}",
        'top_subreddits': top_subreddits,
        'unique_authors': filtered_data['author'].nunique(),
        'avg_comments': filtered_data['num_comments'].mean() if 'num_comments' in filtered_data.columns else 'N/A',
    }
    
    return jsonify({
        'summary': summary,
        'metrics': metrics
    })

@app.route('/api/common_words', methods=['GET'])
def get_common_words():
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    query = request.args.get('query', '')
    limit = int(request.args.get('limit', 50))
    
    # Filter data based on query
    filtered_data = data
    if query:
        filtered_data = data[
            data['selftext'].str.contains(query, case=False, na=False) |
            data['title'].str.contains(query, case=False, na=False)
        ]
    
    # Combine text data
    text_data = filtered_data['title'] + ' ' + filtered_data['selftext'].fillna('')
    
    # Tokenize and count words
    vectorizer = CountVectorizer(stop_words='english', max_features=limit)
    X = vectorizer.fit_transform(text_data)
    
    # Get word frequencies
    words = vectorizer.get_feature_names_out()
    freqs = X.sum(axis=0).A1
    
    # Sort by frequency
    sorted_indices = freqs.argsort()[::-1]
    result = [{'word': words[i], 'count': int(freqs[i])} for i in sorted_indices]
    
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True) 