# Dashboard & Community Research: Claude Code Telemetry Visualization

**Date:** 2026-06-27  
**Scope:** How the community visualizes Claude Code OTLP metrics in Grafana/Prometheus stacks; panel ideas and PromQL patterns to adopt or improve upon.

---

## 1. Official / Sample Dashboards

### 1a. Grafana Cloud Official Integration (Anthropic API)

- **URL:** https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-claude-code/
- **Blog announcement:** https://grafana.com/blog/how-to-monitor-claude-usage-and-costs-introducing-the-anthropic-integration-for-grafana-cloud/ (August 2025)
- **Mechanism:** Collector-less; Grafana Cloud pulls directly from the **Anthropic Usage & Cost REST API** (not OTLP from Claude Code CLI). Different data source than Claude Code's OTLP stream.
- **Metrics used:** `gen_ai_cost` and `gen_ai_usage_tokens_total` with label `gen_ai_anthropic_workspace_id`.
- **Panels:** Total token cost with threshold indicators, tokens by workspace, model usage distribution, performance trends over time.
- **Template variables:** datasource, job, workspace, model.
- **Named dashboards:** "Claude Code," "Claude Code stats," "Claude Code usage breakdown," "Claude Code productivity."
- **Notable gap:** No API latency, no per-user breakdown, no tool/productivity metrics — it only covers API billing data from the Anthropic side.

### 1b. Dashboard 25052 — "Claude Code" (Azure Application Insights / KQL)

- **URL:** https://grafana.com/grafana/dashboards/25052-claude-code/
- **Author:** 1w2w3y
- **Backend:** Azure Monitor (Application Insights), KQL queries — NOT Prometheus/PromQL.
- **Grafana version:** 11.6+
- **Variables:** Azure subscription, resource group, App Insights resource.
- **Panel categories:**

| Category | Visualizations |
|---|---|
| Summary KPIs | Total Cost, Total Sessions, User Prompts, API Requests, API Errors, Active Time |
| Cost & Token Trends | Daily Cost by Model, Daily Token Usage by Type |
| Model Usage | Token Usage by Model, Cost by Model, API Requests by Model |
| Tool Usage | Tool Usage Top Tools, Daily Tool Usage Stacked |
| Productivity | Lines of Code Added vs Removed, Daily Commits, Daily User Prompts |
| Session & Activity | Daily Sessions, Active Time per Day, Code Edit Accept Rate |
| Per-User Metrics | User Summary, Per-User Cost by Model |
| Errors | API Errors Over Time, Error Details |

- **Note:** The KQL dashboard 25052 is the upstream from which the Prometheus/PromQL version 25255 was derived.

### 1c. Dashboard 25255 — "Claude Code Metrics (Prometheus)"

- **URL:** https://grafana.com/grafana/dashboards/25255-claude-code-metrics-prometheus/
- **Author:** rockdarko (GitHub: https://github.com/rockdarko/claude-code-metrics-prometheus)
- **Backend:** Prometheus, VictoriaMetrics, Mimir, Thanos — full PromQL support.
- **Grafana version:** 11+
- **Variables:** organization, user (user_email), model; default time range 7 days.
- **Sections & panels:**

| Section | Panels |
|---|---|
| Overview | Sessions (stat), Users (stat), Total Cost (stat), Total Tokens (stat), Commits (stat), PRs (stat), Lines Added/Removed (stat), Active Time (stat), Tokens by Type (pie/donut), Tool Decisions (stat) |
| Leaderboards | Top Users by Cost (table), Top Users by Tokens (table), Top Sessions by Cost (table), Cost by Model (table), Edit Decisions by Language (table), Sessions by Terminal (table) |
| Cost & Tokens | Cost Over Time (time series), Cost by Model Over Time (time series), Tokens by Type Over Time (stacked area), Tokens by Model Over Time (time series) |
| Activity & Productivity | Active Time per Hour (time series), Lines of Code per Hour (time series), Tool Decisions Over Time (time series accept/reject) |
| Cost Breakdown | Cost by Query Source (bar), Cost by Effort (bar), Cache Hit Ratio (gauge) |

### 1d. Dashboard 24993 — "Claude Code Metrics"

- **URL:** https://grafana.com/grafana/dashboards/24993-claude-code-metrics/
- **Author:** Dreamplug Tech / Marlin project (v1.0.0, 2026-03-11)
- **Backend:** Prometheus datasource variable.
- **Variables:** datasource, organization, user, model, **repo** (git repository — unique addition).
- **Panel types:**

| Visualization | Type |
|---|---|
| Sessions, users, cost, tokens overview | Stat panels |
| Cost over time | Time series (hourly rate) |
| Token usage by type | Stacked area chart |
| Token usage by model | Time series |
| Sessions over time | Time series |
| Active time CLI vs user | Time series |
| Lines of code changes | Time series |
| Tool decisions | Time series |
| Top users by cost | Table/leaderboard |
| Top users by tokens | Table/leaderboard |
| Top repositories by cost | Table/leaderboard |
| Cost distribution | Pie chart |
| Tool usage by language | Pie chart |
| Sessions by terminal type | Pie chart |

- **Unique addition:** `repo` (git repository) as a filter variable and "Top repositories by cost" leaderboard panel.

---

## 2. Community Projects

| Repo / URL | What it offers |
|---|---|
| [rockdarko/claude-code-metrics-prometheus](https://github.com/rockdarko/claude-code-metrics-prometheus) | Complete PromQL dashboard (25255); `resource_to_telemetry_conversion` config for terminal label; MIT license |
| [acreeger/claude-code-metrics-stack](https://github.com/acreeger/claude-code-metrics-stack) | Full Docker Compose stack: OTEL Collector + Prometheus + **Loki** + Grafana; includes log event dashboard (prompt/tool/api_request events); privacy controls for prompt logging |
| [ColeMurray/claude-code-otel](https://github.com/ColeMurray/claude-code-otel) | Comprehensive stack; adds **API latency**, **error rate**, and **tool success rate** panels; multi-pipeline OTEL Collector config for cardinality control at scale |
| [chhoumann/claude-code-monitoring](https://github.com/chhoumann/claude-code-monitoring) | Privacy-first local stack; **WSL-specific** IP detection helper; cardinality granularity levels (high/medium/low/none); two dashboards: Basic and Comprehensive |
| [mikelane gist](https://gist.github.com/mikelane/9bf3053b5608df5858d299d636a48e8f) | Three dashboards: metrics overview, daily/weekly summary, **ROI analysis** with configurable hourly-rate and lines-per-hour variables |
| tcude.net ([blog](https://tcude.net/how-i-monitor-my-claude-code-usage-with-grafana-opentelemetry-and-victoriametrics/)) | VictoriaMetrics setup via K3s; Traefik gRPC routing; GitOps provisioning; notes on `opentelemetry.usePrometheusNaming` flag |
| prokopov.me ([blog](https://prokopov.me/posts/claude-code-observability-grafana-stack/)) | Grafana Alloy pipeline; **cost spike alert rule**; session cardinality control; Tool Trust Signal framing of accept/reject rate |
| [Sealos blog](https://sealos.io/blog/claude-code-metrics/) | Step-by-step Docker Compose guide; Cache Efficiency Gauge with color thresholds; Productivity Ratio Gauge; cost per 1K output tokens panel |
| [OpenObserve article](https://medium.com/devops-ai/openobserve-claude-code-end-to-end-ai-observability-984afcaeba36) | SQL-based (not PromQL); **tool failure rates** (Bash: 7.3%, WebFetch: 11.4%); **operation latency** by tool type; session concentration analysis; 13.5x API amplification per user prompt |
| [DEV.to mikelane](https://dev.to/mikelane/how-i-built-real-time-dashboards-for-claude-code-metrics-with-otel-prometheus-and-grafana-4e7o) | ROI panels: lines/dollar, developer-hour equivalence, Max Plan ROI; notes on `sum_over_time()` vs `increase()` for delta metrics |

---

## 3. Unofficial Docs & Key Insights

### Official telemetry reference (authoritative)

**Source:** https://code.claude.com/docs/en/monitoring-usage (fetched 2026-06-27)

**Complete metrics list with additional labels (current as of fetch):**

| Metric (OTel name) | Prometheus name | Additional labels |
|---|---|---|
| `claude_code.session.count` | `claude_code_session_count_total` | `start_type` (fresh/resume/continue/agents_view) |
| `claude_code.cost.usage` | `claude_code_cost_usage_USD_total` | `model`, `query_source` (main/subagent/auxiliary), `speed` (fast), `effort` (low/medium/high/xhigh/max), `agent.name`, `skill.name`, `plugin.name`, `marketplace.name`, `mcp_server.name`, `mcp_tool.name` |
| `claude_code.token.usage` | `claude_code_token_usage_tokens_total` | `type` (input/output/cacheRead/cacheCreation), `model`, `query_source`, `speed`, `effort`, `agent.name`, `skill.name`, `plugin.name`, `marketplace.name`, `mcp_server.name`, `mcp_tool.name` |
| `claude_code.code_edit_tool.decision` | `claude_code_code_edit_tool_decision_total` | `tool_name` (Edit/Write/NotebookEdit), `decision` (accept/reject), `source` (config/hook/user_permanent/user_temporary/user_abort/user_reject), `language` |
| `claude_code.lines_of_code.count` | `claude_code_lines_of_code_count_total` | `type` (added/removed), `model` (requires v2.1.172+) |
| `claude_code.commit.count` | `claude_code_commit_count_total` | standard attributes only |
| `claude_code.pull_request.count` | `claude_code_pull_request_count_total` | standard attributes only |
| `claude_code.active_time.total` | `claude_code_active_time_seconds_total` | `type` (user/cli) |

**Standard attributes on ALL metrics:** `session.id`, `user.email`, `user.account_uuid`, `user.account_id`, `organization.id`, `user.id` (anonymous), `terminal.type`, custom `OTEL_RESOURCE_ATTRIBUTES` keys, and optionally `app.version`, `app.entrypoint`.

**New labels (recently added, not yet in our plugin):**
- `query_source` on cost + token: distinguishes main session, subagent, and auxiliary requests
- `speed` on cost + token: flags Fast Mode usage
- `effort` on cost + token: low/medium/high/xhigh/max effort levels
- `agent.name`, `skill.name`, `plugin.name` on cost + token: attribution for subagent/skill costs
- `mcp_server.name`, `mcp_tool.name` on cost + token: MCP tool cost attribution
- `start_type` on session: identifies session start mode including the agents dashboard process

**Traces (beta):** Distributed tracing now available via `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`. Spans: `claude_code.interaction` → `claude_code.llm_request`, `claude_code.tool` (→ `blocked_on_user`, `execution`), `claude_code.hook`. Each `llm_request` span carries `ttft_ms`, `duration_ms`, `input_tokens`, `output_tokens`, `stop_reason`, `attempt`, `query_source`, `agent_id`.

**Events (logs):** `claude_code.user_prompt`, `claude_code.tool_result`, `claude_code.api_request` — linked by `prompt.id` (never put on metrics, unbounded cardinality). `api_request` event includes `duration_ms`, `cost_usd`, `input_tokens`, `output_tokens` per request — enabling per-request latency visualization from logs.

### Artificial Curiosity Labs deep-dive

**Source:** https://artificialcuriositylabs.ai/posts/claude-code-otel-metrics/ (unofficial, but reproduces live traffic inspection)

- Confirms meter name: `com.anthropic.claude_code`
- Three original metric names (pre-Prometheus suffix mangling): `claude_code.session.count`, `claude_code.token.usage`, `claude_code.cost.usage`
- Notes `cacheRead` and `cacheCreation` are separate from `input` — critical for cache efficiency math

### OpenObserve observational study

**Source:** https://medium.com/devops-ai/openobserve-claude-code-end-to-end-ai-observability-984afcaeba36 (unofficial)

- Real-world finding: 13.5x API call amplification per user prompt through agentic loops
- Tool failure rates observed: Bash 7.3%, WebFetch 11.4%
- Subagent latency: avg 2.3 min, max 7.7 min
- Session concentration: top 2 sessions = 72% of spend — highlights need for per-session drilldown
- Cache read-to-input token ratio observed at 61:1 in heavy usage — very high cache effectiveness

---

## 4. Panel / Stat Idea Catalog

### Core KPIs (widely implemented — confirm ours match)

| Idea | Metric | Rough PromQL | Why useful |
|---|---|---|---|
| Total cost | cost_usage | `sum(claude_code_cost_usage_USD_total)` | Budget at a glance |
| Total tokens | token_usage | `sum(claude_code_token_usage_tokens_total)` | Volume gauge |
| Active sessions | session_count | `count(count by (session_id)(claude_code_token_usage_tokens_total))` | Concurrent usage |
| Active users | any metric | `count(count by (user_email)(claude_code_cost_usage_USD_total))` | Team adoption |
| Commits / PRs | commit/pr count | `sum(increase(claude_code_commit_count_total[$__range]))` | Productivity output |

### Cache efficiency (underutilized in our plugin)

| Idea | Metric | Rough PromQL | Why useful |
|---|---|---|---|
| Cache hit ratio (gauge with thresholds) | token_usage | `sum(rate(...{type="cacheRead"}[5m])) / (sum(rate(...{type="cacheRead"}[5m])) + sum(rate(...{type="input"}[5m])))` | Red <50%, yellow 50-80%, green >80%; low ratio = overpaying |
| Cache creation vs read trend | token_usage | `sum by (type) (rate(claude_code_token_usage_tokens_total{type=~"cacheRead|cacheCreation"}[5m]))` | Warm-up vs steady-state cache behavior |

### Cost efficiency / ROI (mostly absent from our plugin)

| Idea | Metric | Rough PromQL | Why useful |
|---|---|---|---|
| Lines per dollar | loc + cost | `sum(sum_over_time(claude_code_lines_of_code_count_total[$__range])) / sum(increase(claude_code_cost_usage_USD_total[$__range]))` | Real ROI signal |
| Developer-hour equivalent (assuming 75 LOC/hr) | loc | `sum(sum_over_time(claude_code_lines_of_code_count_total[$__range])) / 75` | Relatable productivity framing |
| Cost per 1K output tokens | token + cost | `sum(increase(claude_code_cost_usage_USD_total[$__range])) / (sum(increase(claude_code_token_usage_tokens_total{type="output"}[$__range])) / 1000)` | Model efficiency comparison |
| Max Plan ROI (for $200/mo subscribers) | cost | `sum(increase(claude_code_cost_usage_USD_total[$__range])) / (6.67 * ($__range_s / 86400))` | Plan value justification |

### Productivity ratio (partially in our plugin)

| Idea | Metric | Rough PromQL | Why useful |
|---|---|---|---|
| CLI/user time ratio (gauge) | active_time | `sum(claude_code_active_time_seconds_total{type="cli"}) / sum(claude_code_active_time_seconds_total{type="user"})` | >10x = effective delegation; <5x = over-directing |
| Active time by type trend | active_time | `sum by (type) (rate(claude_code_active_time_seconds_total[5m]))` | Balance of human vs AI work time |

### Subagent & query_source breakdown (new — not in our plugin)

| Idea | Metric | Rough PromQL | Why useful |
|---|---|---|---|
| Cost by query_source (main/subagent/auxiliary) | cost_usage | `sum by (query_source) (rate(claude_code_cost_usage_USD_total[5m]))` | Identifies agentic overhead vs direct usage |
| Subagent cost fraction | cost_usage | `sum(rate(...{query_source="subagent"}[5m])) / sum(rate(...[5m]))` | Quantifies the 13.5x amplification effect |
| Cost by effort level | cost_usage | `sum by (effort) (increase(claude_code_cost_usage_USD_total[$__range]))` | Shows cost distribution across low/high effort requests |
| Fast Mode cost fraction | cost_usage | `sum(rate(...{speed="fast"}[5m])) / sum(rate(...[5m]))` | Measures Fast Mode adoption and cost impact |

### Model adoption over time (partially in our plugin)

| Idea | Metric | Rough PromQL | Why useful |
|---|---|---|---|
| Model adoption share over time | token_usage | `sum by (model) (rate(claude_code_token_usage_tokens_total[1h]))` | Track migration from Sonnet 4 → Opus → new models |
| Cost by model trend | cost_usage | `sum by (model) (rate(claude_code_cost_usage_USD_total[1h]))` | Model cost mix evolution |

### MCP & skill attribution (new — not in our plugin)

| Idea | Metric | Rough PromQL | Why useful |
|---|---|---|---|
| Cost by skill name | cost_usage | `sum by (skill_name) (increase(claude_code_cost_usage_USD_total[$__range]))` | Which skills drive the most cost |
| Cost by MCP server | cost_usage | `sum by (mcp_server_name) (increase(claude_code_cost_usage_USD_total[$__range]))` | MCP tool cost attribution |
| Cost by agent type | cost_usage | `sum by (agent_name) (increase(claude_code_cost_usage_USD_total[$__range]))` | Subagent cost breakdown |

### Tool decisions (in our plugin, but extendable)

| Idea | Metric | Rough PromQL | Why useful |
|---|---|---|---|
| Acceptance rate by tool name | tool_decision | `sum(rate(...{decision="accept"}[5m])) by (tool_name) / sum(rate(...[5m])) by (tool_name)` | Low acceptance for Write vs Edit signals trust gap |
| Decision source breakdown | tool_decision | `sum by (source) (increase(claude_code_code_edit_tool_decision_total[$__range]))` | config vs hook vs user: automation level insight |
| Acceptance rate by language | tool_decision | `sum(rate(...{decision="accept"}[5m])) by (language) / sum(rate(...[5m])) by (language)` | Already in our plugin |

### Alert rules (not yet implemented)

| Idea | Metric | Alert PromQL | Why useful |
|---|---|---|---|
| Hourly cost spike | cost_usage | `sum(increase(claude_code_cost_usage_USD_total[1h])) > 50` | Budget runaway detection |
| Token burn rate spike | token_usage | `sum(rate(claude_code_token_usage_tokens_total[5m])) > 100000` | Agentic loop runaway |
| Accept rate collapse | tool_decision | `sum(rate(...{decision="accept"}[5m])) / sum(rate(...[5m])) < 0.3` | Something wrong with permissions config |

### Leaderboards (partially in our plugin)

| Idea | Metric | Rough PromQL | Why useful |
|---|---|---|---|
| Top users by cost | cost_usage | `topk(10, sum by (user_email) (increase(claude_code_cost_usage_USD_total[$__range])))` | Cost accountability |
| Top sessions by cost | cost_usage | `topk(10, sum by (session_id) (increase(claude_code_cost_usage_USD_total[$__range])))` | Outlier session detection |
| Top repos by cost (via resource attr) | cost_usage | `topk(10, sum by (repo) (increase(claude_code_cost_usage_USD_total[$__range])))` | Requires `OTEL_RESOURCE_ATTRIBUTES=repo=...` |
| Cost by IDE/terminal | cost_usage | `sum by (terminal_type) (increase(claude_code_cost_usage_USD_total[$__range]))` | Already in our plugin |

### Session start type (new — not in our plugin)

| Idea | Metric | Rough PromQL | Why useful |
|---|---|---|---|
| Session types breakdown | session_count | `sum by (start_type) (increase(claude_code_session_count_total[$__range]))` | Filter out agents_view dashboard launches from real sessions |

---

## 5. Pitfalls

### P1: Delta temporality (most common breakage)

**Problem:** Claude Code defaults to delta temporality (`OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta`). Short sessions complete and flush before Prometheus's scrape window catches them — you get no data.

**Fix:** Always set `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` for Grafana Cloud / Mimir / Prometheus. For VictoriaMetrics, it silently drops delta metrics without warnings.

**Additional:** With Prometheus direct OTLP ingestion, use `--enable-feature=otlp-deltatocumulative` flag; with an OTEL Collector, use the `deltatocumulative` processor.

### P2: `lines_of_code.count` is a delta gauge, not a counter

**Problem:** `claude_code_lines_of_code_count_total` behaves as a delta gauge under delta temporality. `increase()` returns incorrect (extrapolated) values.

**Fix:** Use `sum_over_time(metric[$__range])` instead of `increase(metric[$__range])` for total LOC calculations, especially when the OTEL Collector is doing delta-to-cumulative conversion.

### P3: High cardinality from session_id

**Problem:** `session.id` is included in all metrics by default. Each session creates a new unique label value — this bloats your Prometheus TSDB and slows queries significantly over weeks/months.

**Fix:** Set `OTEL_METRICS_INCLUDE_SESSION_ID=false` for production team deployments. Keep enabled only if you need per-session drilldown panels.

### P4: Counter resets on Claude Code restart

**Problem:** On restart, all cumulative counters reset to 0, causing a false drop in graphs and incorrect `increase()` calculations across the reset boundary.

**Fix:** Prometheus's `increase()` function handles counter resets natively; `rate()` does too. Avoid `delta()` on these metrics. Alert rules based on total sums can fire spuriously after a restart.

### P5: Prometheus naming suffix differences

**Problem:** OTEL metric `claude_code.token.usage` becomes `claude_code_token_usage_tokens_total` in Prometheus (OTel adds the unit suffix `_tokens` and counter suffix `_total`). VictoriaMetrics requires `opentelemetry.usePrometheusNaming=true` to apply the same transformation; without it, queries reference `.`-separated names that are invalid in PromQL.

### P6: `resource_to_telemetry_conversion` must be enabled

**Problem:** Terminal type (`terminal.type`) is a resource attribute, not a datapoint attribute. Without `resource_to_telemetry_conversion: enabled: true` on the Prometheus exporter in the OTEL Collector, it doesn't appear as a Prometheus label.

**Fix:** Add this to the OTEL Collector's Prometheus exporter config block.

### P7: Claude Code `-p` flag (one-shot mode) drops telemetry

**Problem:** The `-p` flag causes sessions to complete too rapidly for telemetry to flush. Observability is unreliable for one-shot automation usage.

**Fix:** Increase `OTEL_METRIC_EXPORT_INTERVAL` or use `OTEL_METRICS_EXPORTER=console` for testing. Accept that very short `-p` sessions will have gaps.

### P8: `agents_view` sessions inflate session counts

**Problem:** The `claude agents` dashboard UI process emits `session.count` metrics with `start_type=agents_view`. These inflate raw session counts and are not actual conversational sessions.

**Fix:** Filter `{start_type!="agents_view"}` on session count queries in all panels.

### P9: Custom `OTEL_RESOURCE_ATTRIBUTES` cardinality

**Problem:** Every key added via `OTEL_RESOURCE_ATTRIBUTES` (e.g., `department=engineering`) becomes a label on every metric series, multiplying cardinality.

**Fix:** For attributes that only need resource-level scoping (not per-datapoint filtering), set `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES=false` and query the resource block separately if your backend supports it.

---

## Summary: Top 8 Ideas to Steal + Must-Fix Pitfalls

### Best ideas to adopt

1. **Cache Hit Ratio gauge** (color-coded red/yellow/green) — the single most actionable efficiency signal; if cacheRead stays tiny vs input, users are paying full price. Not prominently featured in our current plugin.

2. **query_source breakdown** (main / subagent / auxiliary) on cost and token panels — quantifies agentic overhead; the 13.5x amplification finding from real-world data makes this a compelling story for teams using subagents.

3. **effort level cost breakdown** — `low/medium/high/xhigh/max` effort labels on cost_usage are now available; a simple bar chart showing cost distribution by effort level shows which work drives the biggest bills.

4. **Lines per dollar / ROI panel** — `sum(LOC) / sum(cost_USD)` is a compelling business-facing metric that reframes the cost conversation. The developer-hour equivalence framing (divide by 75 LOC/hr) makes it even more relatable.

5. **session start_type filter** — `start_type=agents_view` launches inflate session counts. A simple `{start_type!="agents_view"}` filter in all session queries should be added to avoid misleading graphs.

6. **MCP server and skill attribution panels** — `mcp_server.name` and `skill.name` labels on cost/token are new and completely uncharted in community dashboards; first-mover opportunity to show which MCP tools or skills cost the most.

7. **Cost spike alert rule** — `sum(increase(claude_code_cost_usage_USD_total[1h])) > threshold` is simple to add and extremely valuable for budget control. Multiple community posts call it out as the most-wanted missing piece.

8. **Tool failure rate visualization** — Real-world data shows Bash fails 7.3% and WebFetch 11.4% of the time; this is derivable from the `tool_result` event stream (requires Loki). Even without logs, a panel showing accept rate by `source` (hook vs user vs config) gives insight into automation trust levels.

### Must-fix pitfalls in our plugin

- **P1 (delta temporality):** Already handled in our AGENTS.md with `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` — good, but ensure setup guide text is emphatic about this being the most common failure mode.
- **P8 (agents_view sessions):** We likely do not filter `start_type!=agents_view` on session count queries — check all session panels.
- **P2 (LOC delta gauge):** Audit whether our LOC panels use `increase()` vs `sum_over_time()` — if data flows through an OTEL Collector with `deltatocumulative`, `increase()` may work, but `sum_over_time()` is safer.
- **P3 (session_id cardinality):** Our AppConfig setup guide should call out `OTEL_METRICS_INCLUDE_SESSION_ID=false` as a recommended production setting for large teams.

---

*Sources: All URLs cited inline above. Unofficial/community sources marked accordingly in section 2 and 3.*
