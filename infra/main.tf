terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# --- APIs ---

locals {
  apis = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "firestore.googleapis.com",
    "aiplatform.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.apis)
  service  = each.value

  disable_on_destroy = false
}

# --- Artifact Registry ---

resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = "gundi-webhook-editor"
  format        = "DOCKER"
  description   = "Gundi Webhook Editor Docker images"

  depends_on = [google_project_service.apis]
}

# --- Service Accounts ---

resource "google_service_account" "deploy" {
  account_id   = "github-actions-deploy"
  display_name = "GitHub Actions Deploy"

  depends_on = [google_project_service.apis]
}

resource "google_service_account" "runtime" {
  account_id   = "gundi-webhook-runtime"
  display_name = "Gundi Webhook Editor Runtime"

  depends_on = [google_project_service.apis]
}

# --- IAM Bindings ---

locals {
  deploy_roles = [
    "roles/artifactregistry.writer",
    "roles/run.admin",
    "roles/iam.serviceAccountUser",
  ]
}

resource "google_project_iam_member" "deploy" {
  for_each = toset(local.deploy_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deploy.email}"
}

locals {
  runtime_roles = [
    "roles/datastore.user",
    "roles/aiplatform.user",
  ]
}

resource "google_project_iam_member" "runtime" {
  for_each = toset(local.runtime_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.runtime.email}"
}

# --- Workload Identity Federation ---

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-actions-pool"
  display_name              = "GitHub Actions Pool"

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions-provider"
  display_name                       = "GitHub Actions Provider"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == \"${var.github_repo}\""
}

resource "google_service_account_iam_member" "wif_deploy" {
  service_account_id = google_service_account.deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

# --- Firestore ---

resource "google_firestore_database" "default" {
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.apis]
}
