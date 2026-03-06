variable "project_id" {
  description = "GCP project ID"
  default     = "cdip-dev-78ca"
}

variable "region" {
  description = "GCP region for resources"
  default     = "us-central1"
}

variable "github_repo" {
  description = "GitHub owner/repo, e.g. myorg/gundi-webhook-editor"
  type        = string
}
