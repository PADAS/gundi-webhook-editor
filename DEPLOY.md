# Deploying Gundi Webhook Editor to GCP Cloud Run

## Prerequisites

- [OpenTofu](https://opentofu.org/docs/intro/install/) (`tofu`) installed
- [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`) installed and authenticated
- Access to GCP project `cdip-dev-78ca`
- A GitHub repository for this project
- Firebase project configured (for authentication)

## 1. Provision GCP Infrastructure

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values (especially github_repo)
tofu init
tofu plan    # review what will be created
tofu apply
```

This creates:
- Artifact Registry repository for Docker images
- Deploy service account (`github-actions-deploy`) for CI/CD
- Runtime service account (`gundi-webhook-runtime`) with Firestore access
- Workload Identity Federation for keyless GitHub Actions auth
- Firestore database (native mode)

After apply, run `tofu output` to get the values needed for GitHub configuration.

## 2. Configure GitHub Repository

Go to your repo's **Settings → Secrets and variables → Actions**.

### Variables (Settings → Variables → Actions)

| Variable | Value |
|----------|-------|
| `GCP_PROJECT_ID` | `cdip-dev-78ca` |
| `GCP_REGION` | `us-central1` |
| `AR_REPOSITORY` | `gundi-webhook-editor` |
| `CLOUD_RUN_SERVICE` | `gundi-webhook-editor` |
| `GCP_WIF_PROVIDER` | (from `tofu output wif_provider`) |
| `GCP_SERVICE_ACCOUNT` | `github-actions-deploy@cdip-dev-78ca.iam.gserviceaccount.com` |

### Secrets (Settings → Secrets → Actions)

| Secret | Value |
|--------|-------|
| `FIREBASE_API_KEY` | Your Firebase Web API key |
| `FIREBASE_AUTH_DOMAIN` | `cdip-dev-78ca.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | `cdip-dev-78ca` |
| `ALLOWED_EMAILS` | Comma-separated emails or `@domain.com` |

## 3. Deploy

Push to the `main` branch. GitHub Actions will automatically:

1. Build the Docker image
2. Push it to Artifact Registry
3. Deploy to Cloud Run with the runtime service account

## 4. Verify

1. Check the GitHub Actions run completes successfully
2. Visit the Cloud Run service URL (shown in the GCP Console or Actions output)
3. Sign in and create a filter — verify it persists across page reloads
4. Test the webhook endpoint: `curl -X POST <url>/webhook/<filter_value> -d '{"test": true}'`

## Local Development

```bash
docker compose up -d --build
```

This starts the app with Firebase Auth and Firestore emulators. The app is available at `http://localhost:8080`.
