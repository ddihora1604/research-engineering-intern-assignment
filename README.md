# Social Media Analysis Dashboard

This dashboard provides advanced analytics for social media data, including time series analysis, network graphs, topic modeling, and AI-powered insights.

## Setup Instructions

1. Clone this repository
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Create a `.env` file in the root directory with your Groq API key:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ```
   You can get a Groq API key by signing up at https://console.groq.com/keys

4. Place your dataset in `./data/data.jsonl`

5. Run the application:
   ```
   python app.py
   ```

6. Open your browser and navigate to `http://localhost:5000`

## Features

- Automatic data loading from `./data/data.jsonl`
- Time series analysis of post frequency
- Network analysis of user interactions
- Topic modeling with temporal evolution
- Coordinated behavior detection
- AI-powered insights using Groq LLM API
- Interactive data story generation

## Customizing the Analysis

- Enter search queries to filter the dataset
- Adjust date ranges for temporal analysis
- Modify parameters for topic modeling and coordinated behavior detection

## API Integration

This dashboard uses the Groq API to generate AI-powered insights. If no API key is provided, it will fall back to a simpler local model.

To enable AI-powered insights:
1. Sign up for a Groq account
2. Generate an API key
3. Add the key to your `.env` file
4. Restart the application

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