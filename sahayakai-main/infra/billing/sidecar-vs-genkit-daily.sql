-- Q3E cost-attribution daily roll-up.
--
-- Source: Cloud Billing → BigQuery standard export (see
--   qa/docs/COST_TELEMETRY.md §2 for the gcloud setup).
--
-- Dataset/table placeholders — substitute before running:
--   <BILLING_PROJECT>         e.g. sahayakai-b4248
--   <BILLING_DATASET>         e.g. billing_export
--   <BILLING_ACCOUNT_ID_UND>  underscored billing account id, e.g. 01ABCD_2EFGH3_4IJKLM
--
-- Labels are stamped via:
--   ../sahayakai-agents/deploy/service.yaml         (sidecar prod + cloudbuild staging rewrite)
--   infra/labels/apply-dispatcher-labels.sh         (all 4 services, idempotent)

-- 1. Daily cost per (service, sku, service-tier, cost-bucket) for the current invoice month.
SELECT
  DATE(usage_start_time)    AS usage_date,
  service.description       AS gcp_service,
  sku.description           AS sku,
  (SELECT value FROM UNNEST(labels) WHERE key = 'service-tier') AS service_tier,
  (SELECT value FROM UNNEST(labels) WHERE key = 'cost-bucket')  AS cost_bucket,
  SUM(cost)                 AS cost_usd,
  SUM(IFNULL((SELECT SUM(amount) FROM UNNEST(credits)), 0)) AS credit_usd,
  SUM(cost) + SUM(IFNULL((SELECT SUM(amount) FROM UNNEST(credits)), 0)) AS net_usd
FROM `<BILLING_PROJECT>.<BILLING_DATASET>.gcp_billing_export_v1_<BILLING_ACCOUNT_ID_UND>`
WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
  AND EXISTS (SELECT 1 FROM UNNEST(labels) WHERE key IN ('service-tier', 'cost-bucket'))
GROUP BY usage_date, gcp_service, sku, service_tier, cost_bucket
ORDER BY usage_date DESC, net_usd DESC;

-- 2. Sidecar-vs-Genkit headline: net spend by service-tier per day.
--    Powers the stacked-area chart in Looker Studio.
SELECT
  DATE(usage_start_time) AS usage_date,
  COALESCE((SELECT value FROM UNNEST(labels) WHERE key = 'service-tier'), 'unlabelled') AS service_tier,
  SUM(cost) + SUM(IFNULL((SELECT SUM(amount) FROM UNNEST(credits)), 0)) AS net_usd
FROM `<BILLING_PROJECT>.<BILLING_DATASET>.gcp_billing_export_v1_<BILLING_ACCOUNT_ID_UND>`
WHERE invoice.month = FORMAT_DATE('%Y%m', CURRENT_DATE())
GROUP BY usage_date, service_tier
ORDER BY usage_date DESC, service_tier;
