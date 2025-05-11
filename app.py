from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import json
import pandas as pd
from datetime import datetime
import networkx as nx
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import os

app = Flask(__name__)
CORS(app)

# Global variable to store the loaded data
data = None

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
    filtered_data = data[data['selftext'].str.contains(query, case=False, na=False)]
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
    
    filtered_data = data[data['selftext'].str.contains(query, case=False, na=False)]
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
    
    # Add edges based on reposts/shares
    filtered_data = data[
        data['selftext'].str.contains(query, case=False, na=False) |
        data['title'].str.contains(query, case=False, na=False)
    ]
    for _, row in filtered_data.iterrows():
        if 'repost_of' in row and row['repost_of']:
            G.add_edge(row['author'], row['repost_of'])
    
    # Convert to D3.js format
    nodes = [{'id': node} for node in G.nodes()]
    links = [{'source': source, 'target': target} for source, target in G.edges()]
    
    return jsonify({'nodes': nodes, 'links': links})

@app.route('/api/topics', methods=['GET'])
def get_topics():
    if data is None:
        return jsonify({'error': 'No data loaded'}), 400
    
    n_topics = int(request.args.get('n_topics', 5))
    
    # Prepare text data - combine title and selftext for better topic detection
    data['combined_text'] = data['title'] + ' ' + data['selftext'].fillna('')
    
    # Prepare text data
    vectorizer = CountVectorizer(max_df=0.95, min_df=2, stop_words='english')
    X = vectorizer.fit_transform(data['combined_text'])
    
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

if __name__ == '__main__':
    app.run(debug=True) 