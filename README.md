# JQ Filter Editor

A web application that allows users to create, edit, and test jq filters against JSON documents. This tool helps users develop and validate their jq filters in real-time.

## Features

- Interactive jq filter editor
- Real-time JSON document editing
- Live preview of filter results
- Save and manage multiple filters
- Natural language descriptions for filters
- SQLite database for persistent storage
- FastAPI backend with automatic API documentation

## Prerequisites

- Python 3.8 or higher
- pip (Python package manager)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd jq-editor
```

2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

1. Start the application:
```bash
uvicorn app:app --reload
```

2. Open your web browser and navigate to:
   - Main application: `http://localhost:8000`
   - API documentation: `http://localhost:8000/docs`

3. Create a new filter:
   - Enter a name for your filter
   - Add a natural language description
   - Write your jq filter expression
   - Add sample JSON to test against
   - Click "Test" to see the results
   - Click "Save" to store the filter

## Development

The application is built with:
- FastAPI (Backend)
- SQLite (Database)
- HTML/CSS/JavaScript (Frontend)
- Monaco Editor (Code editing)
- jq (JSON processing)

## API Documentation

FastAPI automatically generates interactive API documentation. You can access it at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## License

MIT License
