# Gundi Webhook Editor

A web app for creating, editing, and testing jq filters against JSON documents. Built with FastAPI and Monaco Editor, deployed to GCP Cloud Run with Firebase Authentication.

## Features

- Interactive jq filter editor with Monaco Editor
- Real-time filter testing against JSON input
- Save and manage multiple named filters
- Firebase Authentication with email allowlisting
- Firestore persistence

## Local Development

### With Docker (recommended)

```bash
docker compose up -d --build
```

This starts the app at `http://localhost:8080` with Firebase Auth and Firestore emulators.

### Without Docker

Requires Python 3.10+ and the system `jq` library (`libjq`).

```bash
pip install -r requirements.txt
AUTH_DISABLED=true uvicorn app:app --reload
```

App runs at `http://localhost:8000`. API docs at `/docs`.

## Infrastructure

GCP infrastructure is managed with [OpenTofu](https://opentofu.org/) in the `infra/` directory. See [DEPLOY.md](DEPLOY.md) for full provisioning and deployment instructions.

## Tech Stack

- **Backend:** FastAPI, jq (Python bindings)
- **Frontend:** Vanilla JS, Monaco Editor
- **Auth:** Firebase Authentication
- **Database:** Firestore
- **Infra:** GCP Cloud Run, Artifact Registry, Workload Identity Federation
- **IaC:** OpenTofu
- **CI/CD:** GitHub Actions

## License

Apache License Version 2.0
