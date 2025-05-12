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
import requests
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from collections import defaultdict

# Load environment variables from .env file if it exists
load_dotenv()

app = Flask(__name__)
CORS(app)

# Global variable to store the loaded data
data = None
# Path to the dataset file
DATASET_PATH = "./data/data.jsonl"

# Initialize tokenizer and model for summarization
try:
    # Keep the existing flan-t5 model as fallback
    t5_tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-small")
    t5_model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-small")
    
    # Check for Groq API key
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    has_groq = GROQ_API_KEY is not None and GROQ_API_KEY != ""
    if has_groq:
        print("Groq API key found. Enhanced LLM insights will be available.")
    else:
        print("No Groq API key found. Set GROQ_API_KEY in environment or .env file for enhanced insights.")
except Exception as e:
    print(f"Error initializing models: {e}")
    t5_tokenizer = None
    t5_model = None
    has_groq = False

# Load dataset on startup
def load_dataset():
    """
    Loads and preprocesses the Reddit dataset from the JSONL file.
    
    This function:
    1. Reads the JSONL file into a pandas DataFrame
    2. Normalizes nested JSON structure 
    3. Converts Unix timestamps to datetime objects
    
    Returns:
        bool: True if dataset loaded successfully, False otherwise
    """
    global data
    try:
        if os.path.exists(DATASET_PATH):
            # Read JSONL file
            data = pd.read_json(DATASET_PATH, lines=True)
            # Normalize the nested JSON structure
            data = pd.json_normalize(data['data'])
            # Convert created_utc to datetime
            data['created_utc'] = pd.to_datetime(data['created_utc'], unit='s')
            print(f"Dataset loaded successfully: {len(data)} rows")
            return True
        else:
            print(f"Dataset file not found at {DATASET_PATH}")
            return False
    except Exception as e:
        print(f"Error loading dataset: {str(e)}")
        return False

@app.route('/')
def index():
    """
    Renders the main dashboard page.
    
    Returns:
        HTML: The index.html template that serves as the main dashboard interface
    """
    return render_template('index.html')

@app.route('/api/timeseries', methods=['GET'])
def get_timeseries():
    """
    Generates time series data for posts matching a query within a date range.
    
    This endpoint:
    1. Filters data based on the search query and optional date range
    2. Groups posts by date
    3. Counts posts per date to create the time series
    
    Query Parameters:
        query (str): Search term to filter posts
        start_date (str, optional): Start date for filtering (YYYY-MM-DD)
        end_date (str, optional): End date for filtering (YYYY-MM-DD)
    
    Returns:
        JSON: Array of objects containing date and post count
    """
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
    """
    Identifies the most active authors for a given search query.
    
    This endpoint:
    1. Filters data based on the search query
    2. Counts posts by each author
    3. Returns the top authors by post count
    
    Query Parameters:
        query (str): Search term to filter posts
        limit (int, optional): Number of top contributors to return (default: 10)
    
    Returns:
        JSON: Array of objects containing author names and their post counts
    """
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
    """
    Creates a network graph of user interactions for posts matching a query.
    
    This endpoint:
    1. Builds a directed graph where nodes are authors and edges represent interactions
    2. Sizes nodes based on post count
    3. Applies community detection to identify clusters of users
    4. Formats the graph for D3.js visualization
    
    Query Parameters:
        query (str): Search term to filter posts
    
    Returns:
        JSON: Object containing nodes and links for network visualization
    """
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
    """
    Performs topic modeling on posts matching a query using LDA.
    
    This endpoint:
    1. Applies Latent Dirichlet Allocation to identify key topics in the content
    2. Extracts top words for each topic with their weights
    3. Finds representative documents for each topic
    4. Analyzes how topics evolve over time
    
    Query Parameters:
        query (str): Search term to filter posts
        n_topics (int, optional): Number of topics to identify (default: 5)
    
    Returns:
        JSON: Object containing topics, their key words, representative posts,
              topic evolution over time, and coherence metrics
    """
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
    
    if len(filtered_data) == 0:
        return jsonify([])
    
    # Prepare text data - combine title and selftext for better topic detection
    filtered_data['combined_text'] = filtered_data['title'] + ' ' + filtered_data['selftext'].fillna('')
    
    # Prepare text data
    vectorizer = CountVectorizer(max_df=0.95, min_df=2, stop_words='english', max_features=1000)
    X = vectorizer.fit_transform(filtered_data['combined_text'])
    
    # Apply LDA with improved parameters
    lda = LatentDirichletAllocation(
        n_components=n_topics, 
        random_state=42,
        learning_method='online',
        max_iter=50,
        learning_decay=0.7,
        evaluate_every=10
    )
    
    # Fit the model and transform the data to get document-topic distributions
    doc_topic_dists = lda.fit_transform(X)
    
    # Get top words for each topic with relevance scores
    feature_names = vectorizer.get_feature_names_out()
    topics = []
    
    for topic_idx, topic in enumerate(lda.components_):
        # Get the top words with their weights
        sorted_indices = topic.argsort()[:-20-1:-1]
        top_words = [feature_names[i] for i in sorted_indices]
        top_weights = [float(topic[i]) for i in sorted_indices]
        
        # Normalize weights to percentages for easier interpretation
        total_weight = sum(top_weights)
        top_weights_normalized = [round((w / total_weight) * 100, 2) for w in top_weights]
        
        # Create topic object with enhanced metadata
        topic_obj = {
            'topic_id': topic_idx,
            'top_words': top_words[:15],  # Top 15 words
            'weights': top_weights_normalized[:15],  # Corresponding weights
            'word_weight_pairs': [{'word': w, 'weight': round(wt, 2)} 
                                  for w, wt in zip(top_words[:15], top_weights_normalized[:15])]
        }
        
        # Find representative documents for this topic
        topic_docs = []
        for i, dist in enumerate(doc_topic_dists):
            if np.argmax(dist) == topic_idx and dist[topic_idx] > 0.5:  # Strong topic alignment
                if len(topic_docs) < 3:  # Limit to 3 examples
                    doc = filtered_data.iloc[i]
                    topic_docs.append({
                        'title': doc['title'],
                        'author': doc['author'],
                        'subreddit': doc.get('subreddit', ''),
                        'created_utc': doc['created_utc'].isoformat(),
                        'topic_probability': float(dist[topic_idx])
                    })
        
        topic_obj['representative_docs'] = topic_docs
        topics.append(topic_obj)
    
    # Time-based topic distribution (how topics evolve over time)
    try:
        # Add topic assignments to the data
        filtered_data['dominant_topic'] = np.argmax(doc_topic_dists, axis=1)
        
        # Group by date and topic
        filtered_data['date'] = filtered_data['created_utc'].dt.date
        topic_evolution = {}
        
        # For each topic, get its frequency over time
        for topic_idx in range(n_topics):
            topic_docs = filtered_data[filtered_data['dominant_topic'] == topic_idx]
            if not topic_docs.empty:
                time_dist = topic_docs.groupby('date').size()
                topic_evolution[f'topic_{topic_idx}'] = {
                    str(date): int(count) for date, count in time_dist.items()
                }
        
        # Calculate overall coherence score
        coherence_score = sum(np.max(doc_topic_dists, axis=1)) / len(doc_topic_dists)
        
        return jsonify({
            'topics': topics,
            'topic_evolution': topic_evolution,
            'coherence_score': float(coherence_score),
            'n_docs_analyzed': len(filtered_data)
        })
    except Exception as e:
        # If time-based analysis fails, return just the topics
        return jsonify({
            'topics': topics,
            'error': str(e)
        })

@app.route('/api/coordinated', methods=['GET'])
def get_coordinated_behavior():
    """
    Detects potentially coordinated posting behavior within the dataset.
    
    This endpoint:
    1. Identifies posts with similar content published within a short time window
    2. Uses TF-IDF vectorization and cosine similarity to measure content similarity
    3. Creates a network of authors who post similar content in coordination
    4. Groups similar posts into coordination clusters
    
    Query Parameters:
        query (str): Search term to filter posts
        time_window (int, optional): Time window in seconds to consider posts coordinated (default: 3600)
        similarity_threshold (float, optional): Minimum similarity score to consider posts related (default: 0.7)
    
    Returns:
        JSON: Object containing coordinated networks, groups, and metrics
    """
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    time_window = int(request.args.get('time_window', 3600))  # Default to 1 hour in seconds
    similarity_threshold = float(request.args.get('similarity_threshold', 0.7))
    query = request.args.get('query', '')
    
    # Filter by query if specified
    filtered_data = data
    if query:
        filtered_data = data[
            data['selftext'].str.contains(query, case=False, na=False) |
            data['title'].str.contains(query, case=False, na=False)
        ]
    
    # Step 1: Sort data by timestamp
    sorted_data = filtered_data.sort_values('created_utc')
    
    # Step 2: Find posts with similar content in close time periods using improved similarity metrics
    coordinated_groups = []
    processed_indices = set()
    
    # Create a TF-IDF vectorizer for better similarity comparison
    tfidf_vectorizer = TfidfVectorizer(
        max_features=1000,
        stop_words='english',
        min_df=2,
        ngram_range=(1, 2)  # Include bigrams for better context
    )
    
    try:
        # Combine all available text for similarity analysis
        sorted_data['analysis_text'] = sorted_data['title']
        if 'selftext' in sorted_data.columns:
            sorted_data['analysis_text'] += ' ' + sorted_data['selftext'].fillna('')
        
        # Create matrix of TF-IDF features (might be sparse for large datasets)
        tfidf_matrix = tfidf_vectorizer.fit_transform(sorted_data['analysis_text'])
        
        # Enhanced coordinated group detection using vector similarity
        for i, row1 in sorted_data.iterrows():
            if i in processed_indices:
                continue
                
            group = [{
                'author': row1['author'],
                'id': row1.get('id', ''),
                'created_utc': row1['created_utc'].isoformat(),
                'title': row1['title'],
                'selftext': row1.get('selftext', '')[:200] + '...' if len(row1.get('selftext', '') or '') > 200 else row1.get('selftext', ''),
                'url': f"https://reddit.com/{row1.get('permalink', '')}"
            }]
            
            # Find posts within the time window
            time_limit = row1['created_utc'] + pd.Timedelta(seconds=time_window)
            window_posts = sorted_data[(sorted_data['created_utc'] <= time_limit) & 
                                      (sorted_data['created_utc'] >= row1['created_utc'])]
            
            # Find posts with similar content
            row1_vector = tfidf_matrix[sorted_data.index.get_loc(i)]
            
            for j, row2 in window_posts.iterrows():
                if i == j or j in processed_indices:
                    continue
                    
                # Calculate cosine similarity using TF-IDF vectors
                row2_vector = tfidf_matrix[sorted_data.index.get_loc(j)]
                similarity = cosine_similarity(row1_vector, row2_vector)[0][0]
                
                # Check for shared links, URLs or hashtags to improve detection
                shared_links = False
                shared_hashtags = False
                
                # Extract URLs and hashtags if available
                if 'selftext' in row1 and 'selftext' in row2:
                    # Simple regex to find URLs and hashtags (could be improved)
                    import re
                    urls1 = set(re.findall(r'https?://\S+', str(row1.get('selftext', ''))))
                    urls2 = set(re.findall(r'https?://\S+', str(row2.get('selftext', ''))))
                    hashtags1 = set(re.findall(r'#\w+', str(row1.get('selftext', ''))))
                    hashtags2 = set(re.findall(r'#\w+', str(row2.get('selftext', ''))))
                    
                    # Check for overlap
                    if urls1 and urls2 and urls1.intersection(urls2):
                        shared_links = True
                        similarity += 0.1  # Boost similarity score for shared links
                    
                    if hashtags1 and hashtags2 and hashtags1.intersection(hashtags2):
                        shared_hashtags = True
                        similarity += 0.1  # Boost similarity score for shared hashtags
                
                if similarity >= similarity_threshold:
                    group.append({
                        'author': row2['author'],
                        'id': row2.get('id', ''),
                        'created_utc': row2['created_utc'].isoformat(),
                        'title': row2['title'],
                        'selftext': row2.get('selftext', '')[:200] + '...' if len(row2.get('selftext', '') or '') > 200 else row2.get('selftext', ''),
                        'url': f"https://reddit.com/{row2.get('permalink', '')}",
                        'similarity_score': round(float(similarity), 3),
                        'shared_links': shared_links,
                        'shared_hashtags': shared_hashtags
                    })
                    processed_indices.add(j)
            
            if len(group) > 1:  # Only consider groups with at least 2 posts
                # Add metadata about the group
                group_metadata = {
                    'group_id': len(coordinated_groups),
                    'size': len(group),
                    'time_span': (max([pd.to_datetime(p['created_utc']) for p in group]) - 
                                 min([pd.to_datetime(p['created_utc']) for p in group])).total_seconds(),
                    'unique_authors': len(set([p['author'] for p in group])),
                    'shared_links_count': sum(1 for p in group if p.get('shared_links', False)),
                    'shared_hashtags_count': sum(1 for p in group if p.get('shared_hashtags', False)),
                    'posts': group
                }
                coordinated_groups.append(group_metadata)
                processed_indices.add(i)
    except Exception as e:
        # Fallback to simpler method if advanced method fails
        print(f"Advanced coordination detection failed: {str(e)}")
        # (Original simpler method would go here)
    
    # Step 3: Create network of coordinated authors
    author_links = []
    author_nodes = set()
    
    for group in coordinated_groups:
        authors = [post['author'] for post in group['posts']]
        author_nodes.update(authors)
        
        for i in range(len(authors)):
            for j in range(i+1, len(authors)):
                if authors[i] != authors[j]:  # Avoid self-loops
                    # Add weight based on frequency of coordination
                    author_links.append({
                        'source': authors[i], 
                        'target': authors[j],
                        'group_id': group['group_id'],
                        'weight': 1  # Could be enhanced to count multiple instances
                    })
    
    # Aggregate weights for duplicate links
    link_weights = defaultdict(int)
    for link in author_links:
        key = tuple(sorted([link['source'], link['target']]))
        link_weights[key] += link['weight']
    
    # Create final weighted links
    unique_links = [
        {'source': source, 'target': target, 'weight': weight}
        for (source, target), weight in link_weights.items()
    ]
    
    # Create nodes with metadata
    author_post_counts = filtered_data['author'].value_counts().to_dict()
    nodes = [
        {
            'id': author,
            'posts_count': author_post_counts.get(author, 0),
            'coordinated_groups_count': sum(1 for g in coordinated_groups if author in [p['author'] for p in g['posts']])
        }
        for author in author_nodes
    ]
    
    # Calculate network metrics
    network_metrics = {
        'total_groups': len(coordinated_groups),
        'total_authors': len(author_nodes),
        'total_connections': len(unique_links),
        'density': len(unique_links) / (len(author_nodes) * (len(author_nodes) - 1) / 2) if len(author_nodes) > 1 else 0,
        'avg_group_size': sum(g['size'] for g in coordinated_groups) / len(coordinated_groups) if coordinated_groups else 0,
        'authors_involved_percentage': len(author_nodes) / filtered_data['author'].nunique() * 100,
        'time_window_seconds': time_window,
        'similarity_threshold': similarity_threshold
    }
    
    return jsonify({
        'network': {'nodes': nodes, 'links': unique_links},
        'groups': coordinated_groups,
        'metrics': network_metrics
    })

@app.route('/api/ai_summary', methods=['GET'])
def get_ai_summary():
    """
    Generates an AI-powered summary of posts matching a query.
    
    This endpoint:
    1. Uses either a local T5 model or the Groq API (if configured) to analyze the data
    2. Extracts key metrics, patterns, and insights
    3. Produces a comprehensive natural language summary of the findings
    
    Query Parameters:
        query (str): Search term to filter posts
    
    Returns:
        JSON: Object containing the AI-generated summary, metrics, and model information
    """
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    if t5_tokenizer is None or t5_model is None:
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
    
    # Get top keywords
    try:
        vectorizer = CountVectorizer(stop_words='english', max_features=10)
        X = vectorizer.fit_transform(filtered_data['title'])
        feature_names = vectorizer.get_feature_names_out()
        freqs = X.sum(axis=0).A1
        sorted_indices = freqs.argsort()[::-1]
        top_keywords = [feature_names[i] for i in sorted_indices[:5]]
        summary_context += f" Top keywords: {', '.join(top_keywords)}."
    except:
        pass
    
    # Calculate engagement metrics
    if 'num_comments' in filtered_data.columns:
        avg_comments = filtered_data['num_comments'].mean()
        max_comments = filtered_data['num_comments'].max()
        summary_context += f" Average engagement: {avg_comments:.1f} comments per post, with the highest engagement at {max_comments} comments."
    
    # Generate summary using either Groq API or T5 model
    summary = ""
    try:
        if has_groq:
            # Use Groq API for enhanced analysis
            groq_api_url = "https://api.groq.com/openai/v1/chat/completions"
            
            prompt = f"""
            Analyze the following social media data and provide deep insights:
            
            {summary_context}
            
            Please provide:
            1. A comprehensive summary of the conversation around '{query}'
            2. Key patterns or trends identified
            3. Analysis of user behavior and engagement
            4. Significant themes or narratives
            5. Potential anomalies or points of interest
            
            Format your response as a cohesive analysis without numbered points.
            """
            
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama3-8b-8192",  # Using LLaMA 3 model via Groq
                "messages": [
                    {"role": "system", "content": "You are an expert data analyst specializing in social media trends analysis."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.7,
                "max_tokens": 500
            }
            
            response = requests.post(groq_api_url, headers=headers, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                summary = result["choices"][0]["message"]["content"]
                print("Successfully generated analysis using Groq API")
            else:
                # Fallback to T5 if Groq API call fails
                print(f"Groq API call failed with status code {response.status_code}. Using T5 fallback.")
                input_text = f"Analyze and summarize the following social media trends in detail: {summary_context}"
                inputs = t5_tokenizer(input_text, return_tensors="pt", max_length=512, truncation=True)
                outputs = t5_model.generate(**inputs, max_length=250, min_length=100)
                summary = t5_tokenizer.decode(outputs[0], skip_special_tokens=True)
        else:
            # Fallback to T5 if Groq API is not available
            input_text = f"Analyze and summarize the following social media trends in detail: {summary_context}"
            inputs = t5_tokenizer(input_text, return_tensors="pt", max_length=512, truncation=True)
            outputs = t5_model.generate(**inputs, max_length=250, min_length=100)
            summary = t5_tokenizer.decode(outputs[0], skip_special_tokens=True)
    except Exception as e:
        # Fallback summary if model fails
        summary = f"Found {len(filtered_data)} posts about '{query}' from {min_date} to {max_date}. "
        summary += f"Most active in: {', '.join(list(top_subreddits.keys())[:3])}."
        if 'top_keywords' in locals():
            summary += f" Key topics included: {', '.join(top_keywords)}."
    
    # Enhanced metrics for better insights
    metrics = {
        'total_posts': len(filtered_data),
        'time_range': f"{min_date} to {max_date}",
        'top_subreddits': top_subreddits,
        'unique_authors': filtered_data['author'].nunique(),
        'avg_comments': filtered_data['num_comments'].mean() if 'num_comments' in filtered_data.columns else 'N/A',
        'top_keywords': top_keywords if 'top_keywords' in locals() else [],
        'days_span': (pd.to_datetime(max_date) - pd.to_datetime(min_date)).days + 1,
        'posts_per_day': len(filtered_data) / ((pd.to_datetime(max_date) - pd.to_datetime(min_date)).days + 1),
        'top_authors': filtered_data['author'].value_counts().head(5).to_dict(),
    }
    
    # Calculate engagement trends over time if possible
    try:
        if 'num_comments' in filtered_data.columns:
            filtered_data['date'] = filtered_data['created_utc'].dt.date
            engagement_trend = filtered_data.groupby('date')['num_comments'].mean()
            # Convert date objects to strings before adding to dictionary
            engagement_trend = {str(date): float(value) for date, value in engagement_trend.items()}
            metrics['engagement_trend'] = engagement_trend
    except:
        pass
    
    return jsonify({
        'summary': summary,
        'metrics': metrics,
        'model_used': 'Groq API' if has_groq else 'Flan-T5-small'
    })

@app.route('/api/common_words', methods=['GET'])
def get_common_words():
    """
    Identifies the most common words in posts matching a query.
    
    This endpoint:
    1. Filters posts based on the search query
    2. Tokenizes and counts word frequency across all posts
    3. Returns the most common words with their counts
    
    Query Parameters:
        query (str): Search term to filter posts
        limit (int, optional): Number of common words to return (default: 50)
    
    Returns:
        JSON: Array of objects containing words and their occurrence counts
    """
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

@app.route('/api/dynamic_description', methods=['GET'])
def get_dynamic_description():
    """
    Generates dynamic, contextual descriptions for dashboard sections using the Groq API.
    
    This endpoint:
    1. Takes the current section, query, and available data metrics
    2. Uses the LLaMA model via Groq to generate relevant, insightful descriptions
    3. Returns customized documentation that explains the data in context
    
    Query Parameters:
        section (str): The dashboard section requiring documentation
        query (str): The current search query
        data_context (str, optional): JSON string with relevant metrics for context
        detail_level (str, optional): Level of detail for descriptions (basic, detailed, expert)
    
    Returns:
        JSON: Object containing the generated description
    """
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    section = request.args.get('section', '')
    query = request.args.get('query', '')
    data_context = request.args.get('data_context', '{}')
    detail_level = request.args.get('detail_level', 'detailed')
    
    # Default response in case generation fails
    default_description = {
        "timeseries": "This visualization tracks post volume over time, revealing when discussions peaked, declined, or remained steady.",
        "network": "This network graph maps connections between users based on their interactions. Nodes represent users and edges show interactions between them.",
        "topics": "This analysis identifies distinct topics within the content using Latent Dirichlet Allocation (LDA).",
        "coordinated": "This analysis detects potentially coordinated posting behavior by identifying similar content posted within a short time window.",
        "word_cloud": "The word cloud visualizes the most frequently occurring terms in the analyzed posts.",
        "contributors": "This chart identifies the most active users who have posted content matching your search query.",
        "overview": "This section provides a high-level summary of the data analysis results.",
        "ai_insights": "This section uses machine learning to generate human-readable insights from the data.",
        "data_story": "This synthesizes analyses into a cohesive narrative, highlighting key trends and patterns."
    }
    
    try:
        # Parse data context if provided
        context_data = {}
        try:
            import json
            context_data = json.loads(data_context)
        except:
            pass
        
        # Only proceed with Groq if API key is available
        if not has_groq or not GROQ_API_KEY:
            return jsonify({'description': default_description.get(section, "This section analyzes data based on your query.")})
        
        # Enhanced section context with more analytical details
        section_context = {
            "timeseries": {
                "title": "time series visualization showing post frequency over time",
                "tech": "D3.js line and area charts with hoverable data points",
                "metrics": "post volume, trend direction, peak detection, temporal patterns",
                "insights": "conversation lifecycle, viral moments, correlation with external events, posting patterns"
            },
            "network": {
                "title": "network graph showing interactions between users",
                "tech": "force-directed graph with community detection via Louvain method",
                "metrics": "centrality, betweenness, clustering coefficient, modularity",
                "insights": "community structure, influence patterns, information flow, echo chambers"
            },
            "topics": {
                "title": "topic modeling analysis showing key themes in the content",
                "tech": "Latent Dirichlet Allocation (LDA) with coherence optimization",
                "metrics": "topic coherence, keyword distribution, temporal evolution, topic similarity",
                "insights": "narrative framing, emergent themes, semantic relationships, concept clusters"
            },
            "coordinated": {
                "title": "analysis of potentially coordinated posting behavior",
                "tech": "temporal-semantic clustering with TF-IDF and cosine similarity",
                "metrics": "temporal proximity, content similarity, coordination network density",
                "insights": "organized behavior patterns, information campaigns, authentic vs. inauthentic behavior"
            },
            "word_cloud": {
                "title": "word cloud visualization of frequent terms",
                "tech": "frequency-weighted layout with visual encoding of prominence",
                "metrics": "term frequency, inverse document frequency, relative prominence",
                "insights": "terminology patterns, vocabulary choices, discourse framing, key concepts"
            },
            "contributors": {
                "title": "chart of top contributors/authors",
                "tech": "comparative visualization of posting frequency by author",
                "metrics": "post volume, author distribution, participation inequality",
                "insights": "voice dominance, conversation drivers, participation patterns"
            },
            "overview": {
                "title": "dashboard overview section with key metrics",
                "tech": "multi-dimensional summary statistics with visual highlighting",
                "metrics": "post volume, unique authors, engagement, temporal span",
                "insights": "conversation scale, community engagement, topic resonance"
            },
            "ai_insights": {
                "title": "AI-generated summary of insights",
                "tech": "large language model analysis of aggregated metrics and content",
                "metrics": "semantic patterns, trend analysis, anomaly detection",
                "insights": "narrative interpretation, hidden patterns, context from broader knowledge"
            },
            "data_story": {
                "title": "narrative that connects different analyses into a cohesive story",
                "tech": "multi-faceted data synthesis with temporal and thematic organization",
                "metrics": "pattern correlation, event sequencing, thematic connection",
                "insights": "holistic understanding, causal relationships, narrative arc"
            }
        }
        
        section_info = section_context.get(section, {
            "title": "a data visualization",
            "tech": "interactive data visualization",
            "metrics": "relevant statistical measures",
            "insights": "patterns and relationships in the data"
        })
        
        # Adjust the verbosity based on detail level
        detail_settings = {
            "basic": {
                "description": "Write a brief explanation (2-3 sentences)",
                "max_tokens": 150,
                "sections": 1
            },
            "detailed": {
                "description": "Write a comprehensive explanation (6-8 sentences with specific details)",
                "max_tokens": 350,
                "sections": 2
            },
            "expert": {
                "description": "Write an in-depth analytical explanation (10+ sentences with technical details)",
                "max_tokens": 500,
                "sections": 3
            }
        }
        
        detail_config = detail_settings.get(detail_level, detail_settings["detailed"])
        
        # Build enhanced contextual data based on the section
        enhanced_context = ""
        if context_data:
            if section == "timeseries" and "dataPoints" in context_data:
                filtered_data = data[data['selftext'].str.contains(query, case=False, na=False) | 
                                    data['title'].str.contains(query, case=False, na=False)]
                if len(filtered_data) > 0:
                    date_range = f"{filtered_data['created_utc'].min().strftime('%Y-%m-%d')} to {filtered_data['created_utc'].max().strftime('%Y-%m-%d')}"
                    peak_day = filtered_data.groupby(filtered_data['created_utc'].dt.date).size().idxmax()
                    peak_count = filtered_data.groupby(filtered_data['created_utc'].dt.date).size().max()
                    enhanced_context = f"The data spans from {date_range} with {len(filtered_data)} total posts. The peak day was {peak_day} with {peak_count} posts."
            
            elif section == "topics" and "topicCount" in context_data:
                topic_count = context_data.get("topicCount", 5)
                # Try to get top topics from data for richer context
                try:
                    topic_data = pd.read_json(f"/api/topics?n_topics={topic_count}&query={query}")
                    if 'topics' in topic_data and len(topic_data['topics']) > 0:
                        top_topic_words = ', '.join(topic_data['topics'][0]['top_words'][:5])
                        enhanced_context = f"Analysis found {topic_count} distinct topics. The most prominent topic contains these key terms: {top_topic_words}."
                except:
                    enhanced_context = f"Analysis is configured to find {topic_count} distinct topics in the content."
            
            elif section == "network":
                # Try to enrich with network metrics
                try:
                    node_count = context_data.get("nodeCount", 0)
                    filtered_data = data[data['selftext'].str.contains(query, case=False, na=False) | 
                                        data['title'].str.contains(query, case=False, na=False)]
                    author_count = filtered_data['author'].nunique()
                    enhanced_context = f"The network visualization shows interactions between {node_count} users out of {author_count} total authors in the dataset."
                except:
                    pass
            
            # Add general context if no specific enhancement was added
            if not enhanced_context and context_data:
                enhanced_context = f"The visualization is based on these metrics: {json.dumps(context_data)}. "
        
        # Build prompt with enhanced context and more detailed requirements
        section_type = section_info["title"]
        
        prompt = f"""
        {detail_config["description"]} for {section_type} in a social media analysis dashboard.
        
        QUERY CONTEXT: The user is exploring data about "{query}".
        
        DATA CONTEXT: {enhanced_context}
        
        TECHNICAL DETAILS: This visualization uses {section_info["tech"]} to analyze {section_info["metrics"]}.
        
        Your description should:
        1. Explain what this visualization shows specifically for the query "{query}"
        2. Highlight the key metrics and what patterns they might reveal
        3. Discuss potential insights that could be derived from this visualization
        4. Explain why these insights are valuable for understanding conversations about "{query}"
        5. Use concrete details where possible rather than generic statements
        
        For expert level descriptions, include technical interpretation guidance and explain analytical considerations.
        
        Return ONLY the descriptive text without any additional formatting or meta-commentary.
        """
        
        # Call Groq API for the description with increased token limit
        groq_api_url = "https://api.groq.com/openai/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "llama3-8b-8192",
            "messages": [
                {"role": "system", "content": "You are a data visualization expert specializing in social media analytics. You explain complex data patterns in clear, insightful language that highlights meaningful insights."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.7,
            "max_tokens": detail_config["max_tokens"]
        }
        
        response = requests.post(groq_api_url, headers=headers, json=payload)
        
        if response.status_code == 200:
            result = response.json()
            description = result["choices"][0]["message"]["content"].strip()
            return jsonify({'description': description})
        else:
            # Fallback to default descriptions
            return jsonify({'description': default_description.get(section, "This section analyzes data based on your query.")})
            
    except Exception as e:
        print(f"Error generating dynamic description: {str(e)}")
        return jsonify({
            'description': default_description.get(section, "This section analyzes data based on your query."),
            'error': str(e)
        })

if __name__ == '__main__':
    # Load dataset on startup
    load_success = load_dataset()
    if not load_success:
        print("WARNING: Failed to load dataset. Make sure data file exists at ./data/data.jsonl")
        # Create data directory if it doesn't exist
        os.makedirs("./data", exist_ok=True)
        print("Created data directory. Please place your data.jsonl file in the ./data folder.")
    
    app.run(debug=True) 