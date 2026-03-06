# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A web app for creating, editing, and testing jq filters against JSON documents. FastAPI backend with a vanilla JS frontend using Monaco Editor.

## Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Run the dev server (port 8000)
uvicorn app:app --reload

# API docs available at /docs (Swagger) and /redoc
```

No test suite exists in this project.

## Architecture

**Single-file backend** (`app.py`): FastAPI app with SQLAlchemy ORM and SQLite (`filters.db`). Defines one model (`JQFilter`) with Pydantic schemas for validation. The `jq` Python library compiles and executes filter expressions.

**API endpoints:**
- `GET/POST /api/filters` — list and create filters
- `GET/PUT/DELETE /api/filters/{id}` — single filter CRUD
- `POST /api/test` — execute a jq filter against JSON input, returns result or error

**Frontend** (`templates/index.html`, `static/js/app.js`, `static/css/style.css`): Single-page app using Monaco Editor for JSON input and filter editing. Communicates with the API via fetch.

## Key Details

- The `jq` pip package requires the system `jq` library (`libjq`) to be installed
- SQLite database file (`filters.db`) is created in the project root at startup
- The `JQFilter.value` field is auto-lowercased with spaces replaced by underscores (via SQLAlchemy `@validates`)
