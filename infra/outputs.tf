output "wif_provider" {
  description = "Full WIF provider resource name (GCP_WIF_PROVIDER)"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deploy_service_account" {
  description = "Deploy service account email (GCP_SERVICE_ACCOUNT)"
  value       = google_service_account.deploy.email
}

output "runtime_service_account" {
  description = "Runtime service account email"
  value       = google_service_account.runtime.email
}

output "ar_repository" {
  description = "Artifact Registry repository name (AR_REPOSITORY)"
  value       = google_artifact_registry_repository.docker.repository_id
}

output "cloud_run_service" {
  description = "Cloud Run service name (CLOUD_RUN_SERVICE)"
  value       = "gundi-webhook-editor"
}
