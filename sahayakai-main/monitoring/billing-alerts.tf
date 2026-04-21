###############################################################################
# SahayakAI — Billing Monitoring & Alerting (Cloud Monitoring + Log-based Metrics)
#
# Project:  sahayakai-b4248
# Service:  sahayakai-hotfix-resilience (Cloud Run, asia-southeast1)
#
# Cost estimate (total): ~$0/month
#   - Log-based metrics: free (first 100 metrics)
#   - Alerting policies: free (first 500 policies)
#   - Notification channels: free
#   - Log storage: already paying for Cloud Run logs; billing logs add <1%
#   - The only cost driver would be if you add uptime checks ($0.30/check/month)
###############################################################################

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

variable "project_id" {
  default = "sahayakai-b4248"
}

variable "notification_email" {
  description = "Email for P2/P3 alerts"
  type        = string
}

variable "pagerduty_service_key" {
  description = "PagerDuty integration key for P1 alerts (leave empty to skip)"
  type        = string
  default     = ""
}

variable "slack_webhook_url" {
  description = "Slack incoming webhook URL for P2 alerts (leave empty to skip)"
  type        = string
  default     = ""
}

# ─── Notification Channels ────────────────────────────────────────────

resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "Billing Alerts Email"
  type         = "email"
  labels = {
    email_address = var.notification_email
  }
}

resource "google_monitoring_notification_channel" "slack" {
  count        = var.slack_webhook_url != "" ? 1 : 0
  project      = var.project_id
  display_name = "Billing Alerts Slack"
  type         = "slack"
  labels = {
    channel_name = "#sahayakai-billing-alerts"
    auth_token   = var.slack_webhook_url
  }
}

# ─── Locals ───────────────────────────────────────────────────────────

locals {
  p1_channels = compact([
    google_monitoring_notification_channel.email.name,
    var.slack_webhook_url != "" ? google_monitoring_notification_channel.slack[0].name : "",
  ])
  p2_channels = compact([
    google_monitoring_notification_channel.email.name,
    var.slack_webhook_url != "" ? google_monitoring_notification_channel.slack[0].name : "",
  ])
  p3_channels = [google_monitoring_notification_channel.email.name]

  # Common log filter prefix — all billing logs use context=BILLING
  billing_log_filter = "resource.type=\"cloud_run_revision\" resource.labels.service_name=\"sahayakai-hotfix-resilience\" resource.labels.location=\"asia-southeast1\" jsonPayload.context=\"BILLING\""
}


###############################################################################
# 1. WEBHOOK HEALTH — No webhooks in 6 hours
#
# Severity:  P1 (revenue at risk — Razorpay may be down or endpoint broken)
# Threshold: 0 webhook events in a 6-hour window
# Channel:   Email + Slack
# Cost:      $0 (log-based metric + alert)
#
# Runbook:
#   1. Check https://status.razorpay.com for outages
#   2. Verify webhook URL in Razorpay Dashboard > Settings > Webhooks
#      Expected: https://sahayakai.app/api/webhooks/razorpay
#   3. curl -X POST the webhook endpoint with a test payload to confirm
#      it returns 200 (not 404/500)
#   4. Check Cloud Run logs: filter by context="BILLING" event="webhook_received"
#      to see last successful webhook timestamp
#   5. If endpoint is returning 500, check recent deployments for regressions
#   6. If Razorpay is down, no action needed — they replay missed webhooks
#      on recovery (up to 24h). Monitor for replay after their recovery.
###############################################################################

resource "google_logging_metric" "webhook_received_count" {
  project = var.project_id
  name    = "billing/webhook_received_count"
  filter  = "${local.billing_log_filter} jsonPayload.data.billing_event=\"webhook_received\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    display_name = "Razorpay Webhooks Received"
  }
}

resource "google_monitoring_alert_policy" "webhook_absence" {
  project      = var.project_id
  display_name = "[P1] Billing: No Razorpay webhooks in 6 hours"
  combiner     = "OR"

  conditions {
    display_name = "Webhook absence"
    condition_absent {
      filter   = "metric.type=\"logging.googleapis.com/user/billing/webhook_received_count\" resource.type=\"cloud_run_revision\""
      duration = "21600s" # 6 hours
      aggregations {
        alignment_period   = "3600s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.p1_channels
  severity              = "CRITICAL"

  documentation {
    content   = "No Razorpay webhooks received in 6 hours. Check Razorpay status page, verify webhook URL, and inspect Cloud Run logs."
    mime_type = "text/markdown"
  }

  alert_strategy {
    auto_close = "86400s" # auto-close after 24h if resolved
  }
}


###############################################################################
# 2. PAYMENT FAILURE RATE — >15% failures in a day
#
# Severity:  P1 (direct revenue loss)
# Threshold: failure_count / (success_count + failure_count) > 0.15
#            over a 24-hour rolling window, evaluated every hour
# Channel:   Email + Slack
# Cost:      $0
#
# Runbook:
#   1. Check Razorpay Dashboard > Payments for failure reasons
#      Common: insufficient funds, bank decline, auth failure
#   2. If failures are from a single bank/issuer → Razorpay-side issue, file ticket
#   3. If failures spike after a deploy → check subscription creation code
#      for wrong plan_id, amount, or currency
#   4. Check if Razorpay is having intermittent issues (status page)
#   5. If >30% failure rate persists >2h, pause new subscription creation
#      and alert users with "payment system maintenance" banner
###############################################################################

resource "google_logging_metric" "payment_success_count" {
  project = var.project_id
  name    = "billing/payment_success_count"
  filter  = "${local.billing_log_filter} jsonPayload.data.billing_event=\"payment_success\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    display_name = "Successful Payments"
  }
}

resource "google_logging_metric" "payment_failed_count" {
  project = var.project_id
  name    = "billing/payment_failed_count"
  filter  = "${local.billing_log_filter} jsonPayload.data.billing_event=\"payment_failed\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    display_name = "Failed Payments"
  }
}

# MQL-based alert using ratio of failures to total
resource "google_monitoring_alert_policy" "payment_failure_rate" {
  project      = var.project_id
  display_name = "[P1] Billing: Payment failure rate >15%"
  combiner     = "OR"

  conditions {
    display_name = "High payment failure rate"
    condition_monitoring_query_language {
      query = <<-MQL
        {
          failed: fetch cloud_run_revision
            | metric 'logging.googleapis.com/user/billing/payment_failed_count'
            | align rate(1h)
            | group_by [], [value_failed: aggregate(value.int64_value)] ;

          total: {
            fetch cloud_run_revision
              | metric 'logging.googleapis.com/user/billing/payment_failed_count'
              | align rate(1h)
              | group_by [], [val: aggregate(value.int64_value)] ;
            fetch cloud_run_revision
              | metric 'logging.googleapis.com/user/billing/payment_success_count'
              | align rate(1h)
              | group_by [], [val: aggregate(value.int64_value)]
          }
          | union
          | group_by [], [value_total: aggregate(val)]
        }
        | ratio
        | window 24h
        | condition ratio > 0.15
      MQL
      duration = "0s"
    }
  }

  notification_channels = local.p1_channels
  severity              = "CRITICAL"

  documentation {
    content   = "Payment failure rate exceeded 15% over the last 24 hours. Check Razorpay dashboard for failure reasons, verify no deploy regressions."
    mime_type = "text/markdown"
  }
}


###############################################################################
# 3. PLAN MISMATCH — Razorpay active but Firestore says 'free'
#
# Severity:  P2 (user getting wrong experience, potential revenue leakage)
# Threshold: Any single occurrence
# Channel:   Email + Slack
# Cost:      $0
#
# Runbook:
#   1. Identify the user from the log: userId, subscriptionId
#   2. Check Razorpay Dashboard: is the subscription actually active?
#   3. Check Firestore: users/{userId}.plan — what does it say?
#   4. If Razorpay is active but Firestore is 'free':
#      → The webhook handler failed to update Firestore
#      → Manually set users/{userId}.plan to the correct plan
#      → Check logs around the subscription activation time for errors
#   5. If this happens repeatedly, the webhook→Firestore update path has a bug
#      → Check src/app/api/webhooks/razorpay/route.ts for the
#        'subscription.activated' handler
#   6. Run the reconciliation job: /api/jobs/billing-reconcile
###############################################################################

resource "google_logging_metric" "plan_mismatch_count" {
  project = var.project_id
  name    = "billing/plan_mismatch_count"
  filter  = "${local.billing_log_filter} jsonPayload.data.billing_event=\"plan_mismatch_detected\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    display_name = "Plan Mismatches Detected"
  }
}

resource "google_monitoring_alert_policy" "plan_mismatch" {
  project      = var.project_id
  display_name = "[P2] Billing: Plan mismatch (Razorpay vs Firestore)"
  combiner     = "OR"

  conditions {
    display_name = "Plan mismatch detected"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/billing/plan_mismatch_count\" resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"
      aggregations {
        alignment_period   = "300s" # 5 min
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.p2_channels
  severity              = "ERROR"

  documentation {
    content   = "Razorpay shows an active subscription but Firestore user.plan is 'free'. Run /api/jobs/billing-reconcile or fix manually."
    mime_type = "text/markdown"
  }
}


###############################################################################
# 4. NEGATIVE CREDIT BALANCE
#
# Severity:  P2 (user may be using features they shouldn't, or deduction bug)
# Threshold: Any single occurrence
# Channel:   Email + Slack
# Cost:      $0
#
# Runbook:
#   1. Identify user from log: userId, creditBalance
#   2. Check Firestore: users/{userId}.credits — confirm it's negative
#   3. Check recent credit deduction logs for this user — was there a race
#      condition (two concurrent AI calls deducting simultaneously)?
#   4. If race condition: the credit deduction code needs a Firestore
#      transaction with a precondition check (balance >= cost)
#   5. Temporary fix: set user's credits to 0 in Firestore
#   6. If systematic: add a Firestore security rule or transaction guard:
#      allow write if request.resource.data.credits >= 0
###############################################################################

resource "google_logging_metric" "credit_balance_negative_count" {
  project = var.project_id
  name    = "billing/credit_balance_negative"
  filter  = "${local.billing_log_filter} jsonPayload.data.billing_event=\"credit_balance_negative\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    display_name = "Negative Credit Balance Events"
  }
}

resource "google_monitoring_alert_policy" "credit_balance_negative" {
  project      = var.project_id
  display_name = "[P2] Billing: Negative credit balance detected"
  combiner     = "OR"

  conditions {
    display_name = "Negative credits"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/billing/credit_balance_negative\" resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.p2_channels
  severity              = "ERROR"

  documentation {
    content   = "A user's credit balance went negative. Check for race conditions in credit deduction. Set credits to 0 and investigate."
    mime_type = "text/markdown"
  }
}


###############################################################################
# 5. BILLING API LATENCY — P95 > 5s on /api/subscribe or /api/webhooks
#
# Severity:  P2 (payment UX degraded, webhook processing may timeout)
# Threshold: P95 latency > 5000ms over a 10-minute window
# Channel:   Email + Slack
# Cost:      $0
#
# Runbook:
#   1. Check Cloud Run metrics: Container CPU / Memory — is the instance
#      throttled? (container/cpu/utilization > 0.8)
#   2. Check if Razorpay API calls are slow: look for "razorpay" in logs
#      with high latency values
#   3. Check Firestore latency: are billing collection reads/writes slow?
#      → Firestore Dashboard > Usage > Read/Write latency
#   4. If Cloud Run cold starts are the issue: set min-instances=1
#      gcloud run services update sahayakai-hotfix-resilience \
#        --min-instances=1 --region=asia-southeast1
#   5. If Razorpay API is slow: add timeout + retry with backoff
#   6. Check for N+1 Firestore queries in the billing handler
###############################################################################

resource "google_logging_metric" "billing_api_latency" {
  project = var.project_id
  name    = "billing/api_latency_ms"
  filter  = "${local.billing_log_filter} jsonPayload.data.billing_event=\"api_latency\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"
    display_name = "Billing API Latency"
  }
  value_extractor = "EXTRACT(jsonPayload.data.latencyMs)"
  bucket_options {
    explicit_buckets {
      bounds = [100, 250, 500, 1000, 2000, 3000, 5000, 10000, 30000]
    }
  }
  label_extractors = {
    "endpoint" = "EXTRACT(jsonPayload.data.endpoint)"
  }
}

resource "google_monitoring_alert_policy" "billing_api_latency_p95" {
  project      = var.project_id
  display_name = "[P2] Billing: API P95 latency >5s"
  combiner     = "OR"

  conditions {
    display_name = "P95 latency exceeded"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/billing/api_latency_ms\" resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5000
      duration        = "600s" # sustained for 10 min
      aggregations {
        alignment_period   = "600s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }

  notification_channels = local.p2_channels
  severity              = "ERROR"

  documentation {
    content   = "Billing API P95 latency exceeds 5 seconds. Check Cloud Run CPU/memory, Razorpay API latency, Firestore write latency, and cold start behavior."
    mime_type = "text/markdown"
  }
}


###############################################################################
# 6. REVENUE MONITORING — Daily MRR summary
#
# This is NOT an alert — it's a scheduled log-based report.
# Implemented as a Cloud Scheduler job that hits an internal API.
# The API aggregates Firestore data and logs a structured summary.
#
# Severity:  P3 (informational)
# Channel:   Email (daily digest)
# Cost:      $0.10/month (Cloud Scheduler job)
#
# The /api/jobs/billing-daily-summary endpoint should:
#   1. Count active subscriptions by plan from Firestore
#   2. Sum MRR = count(pro) * pro_price + count(school) * school_price
#   3. Count new subscriptions today (createdAt > start_of_day)
#   4. Count cancellations today
#   5. Emit a structured log with all figures
#   6. The log-based metric below captures it for dashboards
###############################################################################

resource "google_logging_metric" "daily_mrr" {
  project = var.project_id
  name    = "billing/daily_mrr_inr"
  filter  = "${local.billing_log_filter} jsonPayload.data.billing_event=\"daily_revenue_summary\""
  metric_descriptor {
    metric_kind = "GAUGE"
    value_type  = "DOUBLE"
    unit        = "1"
    display_name = "Daily MRR (INR)"
  }
  value_extractor = "EXTRACT(jsonPayload.data.mrr)"
}

# Alert if MRR drops >20% day-over-day (indicates mass cancellation or bug)
resource "google_monitoring_alert_policy" "mrr_drop" {
  project      = var.project_id
  display_name = "[P2] Billing: MRR dropped >20% day-over-day"
  combiner     = "OR"

  conditions {
    display_name = "MRR drop"
    condition_monitoring_query_language {
      query = <<-MQL
        fetch cloud_run_revision
        | metric 'logging.googleapis.com/user/billing/daily_mrr_inr'
        | align next_older(1d)
        | group_by [], [val: aggregate(value.double_value)]
        | window 2d
        | condition val < val(adjacent_older) * 0.8
      MQL
      duration = "0s"
    }
  }

  notification_channels = local.p2_channels
  severity              = "ERROR"

  documentation {
    content   = "MRR dropped more than 20% compared to yesterday. Check for mass cancellations, webhook processing failures, or billing bugs."
    mime_type = "text/markdown"
  }
}


###############################################################################
# 7. FIRESTORE WRITE FAILURES on billing collections
#
# Severity:  P1 (if we can't write billing state, users don't get their plans)
# Threshold: Any failure in 5 minutes
# Channel:   Email + Slack
# Cost:      $0
#
# Runbook:
#   1. Check the log for firestoreCollection and errorMessage
#   2. Common causes:
#      a. Permission denied → service account missing roles/datastore.user
#         Fix: gcloud projects add-iam-policy-binding sahayakai-b4248 \
#              --member="serviceAccount:640589855975-compute@developer.gserviceaccount.com" \
#              --role="roles/datastore.user"
#      b. Document too large → billing doc exceeding 1MB (unlikely)
#      c. Quota exceeded → check Firestore usage dashboard
#      d. Contention → too many writes to same doc; add retry with backoff
#   3. If writes are failing for subscription updates:
#      → Users are paying but not getting their plan
#      → IMMEDIATE: manually update affected users in Firestore console
#      → Run /api/jobs/billing-reconcile after fix
#   4. Check Firestore health: https://status.firebase.google.com
###############################################################################

resource "google_logging_metric" "firestore_write_failure_count" {
  project = var.project_id
  name    = "billing/firestore_write_failure"
  filter  = "${local.billing_log_filter} jsonPayload.data.billing_event=\"firestore_write_failure\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    display_name = "Billing Firestore Write Failures"
  }
}

resource "google_monitoring_alert_policy" "firestore_write_failure" {
  project      = var.project_id
  display_name = "[P1] Billing: Firestore write failure on billing collection"
  combiner     = "OR"

  conditions {
    display_name = "Firestore write failed"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/billing/firestore_write_failure\" resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  notification_channels = local.p1_channels
  severity              = "CRITICAL"

  documentation {
    content   = "Firestore write failed on a billing collection. Users may be paying but not receiving their plan. Check permissions, quotas, and manually reconcile."
    mime_type = "text/markdown"
  }
}


###############################################################################
# Cloud Monitoring Dashboard — single pane of glass for billing health
###############################################################################

resource "google_monitoring_dashboard" "billing" {
  project        = var.project_id
  dashboard_json = jsonencode({
    displayName = "SahayakAI Billing Health"
    gridLayout = {
      columns = 3
      widgets = [
        {
          title = "Webhooks Received (1h)"
          scorecard = {
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"logging.googleapis.com/user/billing/webhook_received_count\" resource.type=\"cloud_run_revision\""
                aggregation = {
                  alignmentPeriod  = "3600s"
                  perSeriesAligner = "ALIGN_SUM"
                }
              }
            }
          }
        },
        {
          title = "Payment Success vs Failure (24h)"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/billing/payment_success_count\" resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod  = "3600s"
                      perSeriesAligner = "ALIGN_SUM"
                    }
                  }
                }
                legendTemplate = "Success"
              },
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"logging.googleapis.com/user/billing/payment_failed_count\" resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod  = "3600s"
                      perSeriesAligner = "ALIGN_SUM"
                    }
                  }
                }
                legendTemplate = "Failed"
              }
            ]
          }
        },
        {
          title = "Billing API P95 Latency"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"logging.googleapis.com/user/billing/api_latency_ms\" resource.type=\"cloud_run_revision\""
                  aggregation = {
                    alignmentPeriod  = "600s"
                    perSeriesAligner = "ALIGN_PERCENTILE_95"
                  }
                }
              }
              legendTemplate = "P95 (ms)"
            }]
          }
        },
        {
          title = "Plan Mismatches"
          scorecard = {
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"logging.googleapis.com/user/billing/plan_mismatch_count\" resource.type=\"cloud_run_revision\""
                aggregation = {
                  alignmentPeriod  = "86400s"
                  perSeriesAligner = "ALIGN_SUM"
                }
              }
            }
          }
        },
        {
          title = "Negative Credit Events"
          scorecard = {
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"logging.googleapis.com/user/billing/credit_balance_negative\" resource.type=\"cloud_run_revision\""
                aggregation = {
                  alignmentPeriod  = "86400s"
                  perSeriesAligner = "ALIGN_SUM"
                }
              }
            }
          }
        },
        {
          title = "MRR (INR)"
          scorecard = {
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"logging.googleapis.com/user/billing/daily_mrr_inr\" resource.type=\"cloud_run_revision\""
                aggregation = {
                  alignmentPeriod  = "86400s"
                  perSeriesAligner = "ALIGN_MAX"
                }
              }
            }
          }
        }
      ]
    }
  })
}
