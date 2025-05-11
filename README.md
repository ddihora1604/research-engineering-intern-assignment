# Social Media Analysis Dashboard

An interactive dashboard for analyzing social media data using Python (Flask) and vanilla JavaScript (D3.js).

## Features

- Upload and analyze JSONL files containing social media data
- Interactive visualizations:
  - Time series analysis of posts
  - Top contributing accounts
  - Network analysis of reposts/shares
  - Topic modeling using LDA
- Real-time data filtering and analysis
- Responsive and modern UI

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd social-media-analysis-dashboard
```

2. Create a virtual environment (optional but recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install the required packages:
```bash
pip install -r requirements.txt
```

## Usage

1. Start the Flask server:
```bash
python app.py
```

2. Open your web browser and navigate to:
```
http://localhost:5000
```

3. Upload a JSONL file containing social media data. The file should have the following structure:
```json
{
    "text": "Post content",
    "author": "Username",
    "created_at": "2024-03-20T12:00:00Z",
    "repost_of": "Original author username"
}
```

4. Use the dashboard controls to:
   - Enter search queries (keywords, hashtags, or URLs)
   - Select date ranges
   - Choose analysis metrics
   - View different visualizations

## Project Structure

```
├── app.py              # Flask application
├── data_loader.py      # JSONL parsing utilities
├── analysis/          # Analysis modules
│   ├── timeseries.py
│   ├── network.py
│   └── topics.py
├── static/           # Static files
│   ├── js/
│   │   └── dashboard.js
│   └── css/
├── templates/        # HTML templates
│   └── index.html
├── requirements.txt  # Python dependencies
└── README.md        # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.