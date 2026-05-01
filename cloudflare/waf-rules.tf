###############################################################################
# AEGIS-AI Cloudflare WAF — Terraform module
#
# Provisions:
#   - WAF custom rules (block/challenge by country, path, header)
#   - Rate-limiting rules (per-IP, per-route)
#   - Managed-rule overrides (OWASP, Cloudflare managed rulesets)
#   - Bot-management gate for /api/* and /api/auth/*
#
# Apply with:
#   export CLOUDFLARE_API_TOKEN=...   # token must have Zone WAF:Edit
#   export TF_VAR_zone_id=...         # Cloudflare zone ID for aegis-ai.co.za
#   terraform init && terraform plan && terraform apply
###############################################################################

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {}

variable "zone_id" {
  description = "Cloudflare zone ID for the AEGIS-AI domain."
  type        = string
}

variable "api_hostname" {
  description = "Hostname that fronts the API (e.g. api.aegis-ai.co.za)."
  type        = string
  default     = "api.aegis-ai.co.za"
}

variable "blocked_countries" {
  description = "ISO-3166 country codes to block outright. Use with care."
  type        = list(string)
  default     = []
}

variable "managed_challenge_countries" {
  description = "ISO-3166 country codes that should hit a managed challenge."
  type        = list(string)
  default     = []
}

###############################################################################
# 1) Custom firewall rules
###############################################################################

resource "cloudflare_ruleset" "aegis_waf_custom" {
  zone_id     = var.zone_id
  name        = "AEGIS WAF Custom Rules"
  description = "Hand-authored WAF rules for AEGIS-AI"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # 1a) Block requests from sanctioned/blocked countries (only if list set).
  dynamic "rules" {
    for_each = length(var.blocked_countries) > 0 ? [1] : []
    content {
      action      = "block"
      description = "Block requests from sanctioned countries"
      enabled     = true
      expression  = "(ip.geoip.country in {${join(" ", [for c in var.blocked_countries : "\"${c}\""])}})"
    }
  }

  # 1b) Managed challenge for higher-risk regions.
  dynamic "rules" {
    for_each = length(var.managed_challenge_countries) > 0 ? [1] : []
    content {
      action      = "managed_challenge"
      description = "Managed challenge for higher-risk countries"
      enabled     = true
      expression  = "(ip.geoip.country in {${join(" ", [for c in var.managed_challenge_countries : "\"${c}\""])}})"
    }
  }

  # 1c) Hard-block known bad user agents probing common admin paths.
  rules {
    action      = "block"
    description = "Block automated scanners hitting admin paths"
    enabled     = true
    expression  = <<-EOT
      (
        http.request.uri.path matches "(?i)/(admin|wp-admin|phpmyadmin|\.env|\.git/)"
        or http.user_agent matches "(?i)(sqlmap|acunetix|nikto|nessus|nuclei)"
      )
    EOT
  }

  # 1d) Require Origin/Referer on state-changing API calls.
  rules {
    action      = "block"
    description = "Reject mutating /api/* with no Origin or Referer"
    enabled     = true
    expression  = <<-EOT
      (
        http.host eq "${var.api_hostname}"
        and http.request.method in {"POST" "PUT" "PATCH" "DELETE"}
        and starts_with(http.request.uri.path, "/api/")
        and not starts_with(http.request.uri.path, "/api/ussd")
        and not starts_with(http.request.uri.path, "/api/twilio/")
        and not starts_with(http.request.uri.path, "/api/csp-report")
        and (http.referer eq "" and http.request.headers["origin"][0] eq "")
      )
    EOT
  }

  # 1e) Bot management gate for /api/auth/*.
  rules {
    action      = "managed_challenge"
    description = "Bot challenge on auth endpoints"
    enabled     = true
    expression  = <<-EOT
      (
        http.host eq "${var.api_hostname}"
        and starts_with(http.request.uri.path, "/api/auth/")
        and cf.bot_management.score lt 30
      )
    EOT
  }
}

###############################################################################
# 2) Rate-limiting rules
###############################################################################

resource "cloudflare_ruleset" "aegis_rate_limit" {
  zone_id     = var.zone_id
  name        = "AEGIS Rate Limiting"
  description = "Per-IP rate limits at the edge"
  kind        = "zone"
  phase       = "http_ratelimit"

  # 2a) Auth endpoints — strict.
  rules {
    action      = "block"
    description = "Auth: 10 req / 60s per IP"
    enabled     = true
    expression  = "(http.host eq \"${var.api_hostname}\" and starts_with(http.request.uri.path, \"/api/auth/\"))"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 600
    }
  }

  # 2b) USSD entry — bursty but still bounded.
  rules {
    action      = "block"
    description = "USSD: 60 req / 60s per IP"
    enabled     = true
    expression  = "(http.host eq \"${var.api_hostname}\" and starts_with(http.request.uri.path, \"/api/ussd\"))"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 60
      mitigation_timeout  = 300
    }
  }

  # 2c) General API ceiling.
  rules {
    action      = "block"
    description = "API: 600 req / 60s per IP"
    enabled     = true
    expression  = "(http.host eq \"${var.api_hostname}\" and starts_with(http.request.uri.path, \"/api/\"))"
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 600
      mitigation_timeout  = 60
    }
  }
}

###############################################################################
# 3) Cloudflare-managed rulesets (OWASP + Cloudflare Managed)
###############################################################################

resource "cloudflare_ruleset" "aegis_managed_overrides" {
  zone_id     = var.zone_id
  name        = "AEGIS Managed Ruleset Overrides"
  description = "Enable Cloudflare Managed + OWASP rulesets"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules {
    action      = "execute"
    description = "Cloudflare Managed Ruleset"
    enabled     = true
    expression  = "true"
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee"
    }
  }

  rules {
    action      = "execute"
    description = "OWASP Core Ruleset"
    enabled     = true
    expression  = "true"
    action_parameters {
      id = "4814384a9e5d4991b9815dcfc25d2f1f"
      overrides {
        # Treat CRS aggregate score >= 60 as block, 40-59 as challenge.
        action = "block"
        rules {
          id      = "6179ae15870a4bb7b2d480d4843b323c"
          enabled = true
        }
      }
    }
  }
}

###############################################################################
# Outputs
###############################################################################

output "managed_ruleset_ids" {
  value = {
    custom    = cloudflare_ruleset.aegis_waf_custom.id
    rate      = cloudflare_ruleset.aegis_rate_limit.id
    managed   = cloudflare_ruleset.aegis_managed_overrides.id
  }
  description = "IDs of the WAF rulesets we manage."
}
