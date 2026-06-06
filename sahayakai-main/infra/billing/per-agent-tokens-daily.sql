-- Q3E per-agent token consumption from the `dispatch.cost` Cloud
-- Logging events (sinked into BigQuery — see
-- infra/billing/dispatch-cost-log-sink.sh).
--
-- Substitute:
--   <LOG_PROJECT>   e.g. sahayakai-b4248
--   <LOG_DATASET>   e.g. dispatch_cost
--   <LOG_TABLE>     e.g. run_googleapis_com_stdout    (auto-named by the sink)

-- 1. Per-agent / per-source daily token counts. Powers the line chart.
SELECT
  DATE(timestamp)                       AS usage_date,
  jsonPayload.agent                     AS agent,
  jsonPayload.source                    AS source,
  SUM(CAST(jsonPayload.estimated_tokens AS INT64)) AS estimated_tokens,
  COUNT(*)                              AS dispatch_count,
  AVG(CAST(jsonPayload.latency_ms AS FLOAT64))     AS avg_latency_ms
FROM `<LOG_PROJECT>.<LOG_DATASET>.<LOG_TABLE>`
WHERE jsonPayload.event = 'dispatch.cost'
  AND DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY usage_date, agent, source
ORDER BY usage_date DESC, estimated_tokens DESC;

-- 2. Weekly sidecar vs Genkit ratio per agent — backs the > 2× alert.
WITH weekly AS (
  SELECT
    DATE_TRUNC(DATE(timestamp), WEEK(MONDAY)) AS week_start,
    jsonPayload.agent                          AS agent,
    jsonPayload.source                         AS source,
    SUM(CAST(jsonPayload.estimated_tokens AS INT64)) AS tokens
  FROM `<LOG_PROJECT>.<LOG_DATASET>.<LOG_TABLE>`
  WHERE jsonPayload.event = 'dispatch.cost'
    AND DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
  GROUP BY week_start, agent, source
)
SELECT
  week_start,
  agent,
  SUM(IF(source = 'sidecar', tokens, 0)) AS sidecar_tokens,
  SUM(IF(source IN ('genkit', 'genkit_fallback'), tokens, 0)) AS genkit_tokens,
  SAFE_DIVIDE(
    SUM(IF(source = 'sidecar', tokens, 0)),
    NULLIF(SUM(IF(source IN ('genkit', 'genkit_fallback'), tokens, 0)), 0)
  ) AS sidecar_over_genkit_ratio
FROM weekly
GROUP BY week_start, agent
ORDER BY week_start DESC, agent;
