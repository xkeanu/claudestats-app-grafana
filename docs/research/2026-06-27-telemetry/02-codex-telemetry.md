# OpenAI Codex CLI Telemetry Research

**Date:** 2026-06-27  
**Author:** Research agent  
**Purpose:** Determine Codex CLI telemetry capabilities for integration as a second data source in the Claude Stats Grafana plugin.

---

## Telemetry Capabilities Overview

**Verdict: YES — Codex CLI emits OpenTelemetry natively as of June 2026.**

OpenTelemetry support landed via [PR #2103](https://github.com/openai/codex/pull/2103) (merged September 29, 2025, author @apanasenko-oai). The implementation covers all three OTel signal types: **logs (structured events), metrics (counters + histograms), and traces**. All are exportable to any OTLP-compatible backend including Grafana Cloud and Prometheus.

Grafana itself ships a native [OpenAI Codex integration](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-openai-codex/) with three prebuilt dashboards (Overview, Usage, Performance), confirming this is a production-grade, supported path.

**Key characteristics:**
- Configuration is entirely in `~/.codex/config.toml` under `[otel]` (user-level only; project-level `.codex/config.toml` ignores `otel` keys with a startup warning)
- All exporters are **opt-in** — the default `exporter = "none"` records events locally but sends nothing
- Metrics default to the internal `statsig` exporter; switch to `otlp-http` or `otlp-grpc` for external backends
- Metrics use **delta temporality** (same as Claude Code), requiring a `deltatocumulative` OTEL Collector processor for self-hosted Prometheus, or direct OTLP ingestion to Grafana Cloud Mimir
- User prompts are **redacted by default** (`log_user_prompt = false`)
- `codex exec` and `codex mcp-server` entry points **do not emit telemetry** (tracked upstream as issue #12913 — UNVERIFIED exact issue number)

---

## Metrics / Events Reference

### OTel Metrics (counters and histograms)

Sources: [Oodle AI docs](https://docs.oodle.ai/ai-agent-observability/codex), [danielvaughan.com](https://codex.danielvaughan.com/2026/04/20/codex-cli-observability-opentelemetry-traces-metrics-production-monitoring/), [DeepWiki](https://deepwiki.com/openai/codex/9.4-observability-and-telemetry)

| Metric Name | Type | Labels | Description |
|---|---|---|---|
| `codex_turn_token_usage` | Counter | `model`, `token_type` (input/output/cached/reasoning), `originator` | Token consumption per conversation turn |
| `codex_thread_started` | Counter | `model`, `originator` | Conversation/session initiations |
| `codex_turn_tool_call` | Counter | `model`, `originator` | Tool invocation count per turn |
| `codex_websocket_request` | Counter | `model`, `success` | WebSocket API request count |
| `codex_turn_e2e_duration_ms` | Histogram | `model` | End-to-end latency per turn |
| `codex_turn_ttft_ms` | Histogram | `model` | Time-to-first-token |
| `codex_turn_ttfm_ms` | Histogram | `model` | Time-to-first-message |
| `codex_ws_event_duration_ms` | Histogram | `model` | WebSocket event processing duration |
| `codex_startup_prewarm_duration_ms` | Histogram | — | Startup latency |
| `codex_shell_snapshot_duration_ms` | Histogram | — | Shell snapshot capture latency |
| `codex.api_request` | Counter | `model`, `status`, `auth_mode`, `originator`, `session_source`, `app.version` | Total outbound API calls |
| `codex.api_request.duration_ms` | Histogram | — | API request latency distribution |
| `codex.tool.call` | Counter | `tool_name` | Tool invocation frequency |
| `codex.tool.call.duration_ms` | Histogram | — | Tool execution time distribution |

**Note:** Metric names from different sources use both `codex_*` (underscore) and `codex.*` (dot) conventions — this likely reflects naming in the Prometheus-scraped form vs. the OTLP/native form respectively.

### OTel Log Events (structured)

Source: [PR #2103](https://github.com/openai/codex/pull/2103), [config-advanced docs](https://developers.openai.com/codex/config-advanced)

All log events carry these **common attributes**:

| Attribute | Description |
|---|---|
| `event.timestamp` | ISO timestamp |
| `conversation.id` | Session/conversation unique ID |
| `app.version` | Codex CLI version |
| `auth_mode` | Authentication mode |
| `user.account_id` | User identifier (when available) |
| `terminal.type` | Terminal/IDE type (e.g., vscode, cursor, iTerm) |
| `model` | Active model |
| `slug` | Context slug |
| `service.name` | Always `"codex-cli"` |
| `env` | Environment tag (from `otel.environment`) |

#### `codex.conversation_starts`
Session initialization details: conversation ID, model, user email, sandbox/approval settings, reasoning mode.

#### `codex.api_request`
Outbound LLM call: `attempt`, `duration_ms`, `http.response.status_code`, `error.message` (on failure), `cf_ray`.

#### `codex.sse_event`
Streaming completion event — **primary token data source**:

| Attribute | Notes |
|---|---|
| `event.kind` | Stream event classification |
| `duration_ms` | Stream event duration |
| `input_token_count` | Input tokens for this completion |
| `output_token_count` | Output tokens |
| `cached_token_count` | Cache-hit tokens (optional) |
| `reasoning_token_count` | Reasoning tokens (optional) |
| `tool_token_count` | Tool-use tokens |
| `error.message` | Present on failure |

#### `codex.user_prompt`
`prompt_length` (character count), `prompt` text (redacted unless `log_user_prompt = true`).

#### `codex.tool_decision`

| Attribute | Values |
|---|---|
| `tool_name` | Tool identifier |
| `call_id` | Unique call ID |
| `decision` | `approved` / `approved_for_session` / `denied` / `abort` |
| `source` | `config` (auto-approved/denied by config) or `user` (interactive) |

#### `codex.tool_result`
`tool_name`, `call_id`, `duration_ms`, `success` (bool), `output` snippet.

#### `codex.websocket_request` / `codex.websocket_event` / `codex.websocket_connect`
WebSocket API request/event timing and success status.

### Session JSONL Logs (local files)

Path: `~/.codex/sessions/YYYY/MM/DD/rollout-{ISO_TIMESTAMP}-{UUID}.jsonl`  
Also: `~/.codex/archived_sessions/` (same format, de-duplicated by ccusage)

Each record is an `event_msg`. The key record type for usage analysis is `payload.type === "token_count"`, which reports **cumulative** token totals; per-turn delta is computed by subtraction. Fields present: input tokens, cached input tokens, output tokens, reasoning tokens. Model is carried in `turn_context` metadata.

Tools like [ccusage](https://ccusage.com/guide/codex/) parse these files to compute cost by multiplying token counts against LiteLLM pricing tables. The JSONL also records tool calls (exec commands, MCP tools, patch apply, web searches, image generation).

**No cost data is stored in JSONL** — cost is always derived from tokens × pricing.

---

## Config / Flags Reference

All telemetry keys go in `~/.codex/config.toml` (user-level; project-level is ignored for `[otel]`).

| Key | Type | Default | Notes |
|---|---|---|---|
| `otel.environment` | string | `"dev"` | Resource attribute applied to all events |
| `otel.log_user_prompt` | bool | `false` | Include raw prompt text in logs |
| `otel.exporter` | enum | `"none"` | Log exporter: `none` / `otlp-http` / `otlp-grpc` |
| `otel.metrics_exporter` | enum | `"statsig"` | Metrics exporter: `none` / `statsig` / `otlp-http` / `otlp-grpc` |
| `otel.trace_exporter` | enum | `"none"` | Trace exporter: `none` / `otlp-http` / `otlp-grpc` |
| `otel.exporter."otlp-http".endpoint` | string | — | OTLP/HTTP logs endpoint, e.g. `https://host/v1/logs` |
| `otel.exporter."otlp-http".protocol` | enum | — | `"binary"` (protobuf) or `"json"` |
| `otel.exporter."otlp-http".headers` | map | — | Auth headers, supports `${ENV_VAR}` interpolation |
| `otel.exporter."otlp-http".tls.*` | string | — | ca-certificate, client-certificate, client-private-key paths |
| `otel.exporter."otlp-grpc".endpoint` | string | — | gRPC endpoint, e.g. `https://host:4317` |
| `otel.exporter."otlp-grpc".headers` | map | — | Auth headers |
| `otel.trace_exporter."otlp-*".*` | same | — | Mirrors exporter config for traces |
| `otel.metrics_exporter."otlp-*".*` | same | — | Mirrors exporter config for metrics |
| `analytics.enabled` | bool | client default | Disable anonymous product analytics (separate from OTel) |
| `log_dir` | string | `$CODEX_HOME/log` | Directory for plaintext TUI log; setting it enables `codex-tui.log` |

**Grafana Cloud example config:**

```toml
[otel]
environment = "production"
log_user_prompt = false

exporter = { "otlp-http" = {
  endpoint = "https://otlp-gateway-prod-<region>.grafana.net/otlp/v1/logs",
  protocol = "binary",
  headers = { "Authorization" = "Basic <base64-instance:token>" }
}}

trace_exporter = { "otlp-http" = {
  endpoint = "https://otlp-gateway-prod-<region>.grafana.net/otlp/v1/traces",
  protocol = "binary",
  headers = { "Authorization" = "Basic <base64-instance:token>" }
}}

metrics_exporter = { "otlp-http" = {
  endpoint = "https://otlp-gateway-prod-<region>.grafana.net/otlp/v1/metrics",
  protocol = "binary",
  headers = { "Authorization" = "Basic <base64-instance:token>" }
}}
```

Access policy token requires `metrics:write`, `logs:write`, `traces:write`.

---

## Claude Code vs Codex CLI: Side-by-Side Mapping

| Stat Category | Claude Code Metric | Codex CLI Equivalent | Fidelity |
|---|---|---|---|
| **Cost (USD)** | `claude_code_cost_usage_USD_total` | None — derive from `codex_turn_token_usage` × model pricing | Partial: must compute externally (ccusage pattern) |
| **Input tokens** | `claude_code_token_usage_tokens_total{type="input"}` | `codex_turn_token_usage{token_type="input"}` | Full equivalent |
| **Output tokens** | `claude_code_token_usage_tokens_total{type="output"}` | `codex_turn_token_usage{token_type="output"}` | Full equivalent |
| **Cache read tokens** | `claude_code_token_usage_tokens_total{type="cacheRead"}` | `codex_turn_token_usage{token_type="cached"}` | Full equivalent |
| **Cache creation tokens** | `claude_code_token_usage_tokens_total{type="cacheCreation"}` | None (no cache write metric) | Gap |
| **Reasoning tokens** | None | `codex_turn_token_usage{token_type="reasoning"}` | Codex-only |
| **Sessions / threads** | `claude_code_session_count_total` | `codex_thread_started` | Full equivalent |
| **Tool decisions** | `claude_code_code_edit_tool_decision_total` (accept/reject, tool_name, language) | `codex.tool_decision` log event (approved/denied/abort, tool_name, source) | Equivalent; Codex has no `language` label |
| **Tool call count** | Derived from `code_edit_tool_decision_total` | `codex_turn_tool_call` + `codex.tool.call` | Codex richer (per-tool duration histogram) |
| **Lines of code** | `claude_code_lines_of_code_count_total` (added/removed) | **NOT AVAILABLE** | Gap — no LOC metric in Codex |
| **Git commits** | `claude_code_commit_count_total` | **NOT AVAILABLE** | Gap |
| **Pull requests** | `claude_code_pull_request_count_total` | **NOT AVAILABLE** | Gap |
| **Active time** | `claude_code_active_time_seconds_total` (user/cli) | Partial: `codex_turn_e2e_duration_ms` (per-turn wall clock) | Partial — different semantics (wall time vs. active time) |
| **Model breakdown** | `model` label on all metrics | `model` label on all metrics | Full equivalent |
| **User identity** | `user_email` label on all metrics | `user.account_id` in log events only; no user label on metrics | Significant gap — no per-user Prometheus label |
| **Terminal / IDE** | `terminal_type` label on metrics | `terminal.type` on log events only | Gap on metrics; present in logs |
| **OS type** | `os_type` label | None detected | Gap |
| **Device** | `device` label (custom OTEL resource attribute) | `otel.environment` (environment-level only, not per-device) | Partial |
| **API latency** | None | `codex_turn_e2e_duration_ms`, `codex_turn_ttft_ms`, `codex_turn_ttfm_ms`, `codex.api_request.duration_ms` | Codex-only (richer performance data) |
| **Version tracking** | N/A | `app.version` on all events | Codex-only |

---

## Gaps and Workarounds

### Critical Gaps

1. **No cost metric.** Codex emits no USD cost counter. Workaround: compute cost as a recording rule in Prometheus using `codex_turn_token_usage` × per-model pricing constants (the same approach ccusage uses, sourced from LiteLLM pricing tables). Requires updating pricing constants when OpenAI changes rates.

2. **No per-user label on OTel metrics.** `user.account_id` appears only in structured log events (`codex.conversation_starts`), not as a Prometheus label on metrics. This is the most significant architectural difference from Claude Code. Workaround: ingest logs into Loki alongside metrics in Prometheus, and correlate by `conversation.id`; or use a Grafana datasource that can join logs+metrics.

3. **No LOC, commit, or PR metrics.** Codex does not track file-level changes, git commits, or PRs in its telemetry. No workaround within the OTel pipeline — would require a separate git hook or CI-level instrumentation.

4. **No language label on tool decisions.** Claude Code tags `code_edit_tool_decision_total` with `language`; Codex `codex.tool_decision` has `tool_name` and `source` but no language. Workaround: parse session JSONL patch events for file extensions (brittle).

5. **`codex exec` / `codex mcp-server` emit no telemetry** (known upstream gap, June 2026).

### Secondary Gaps

6. **Delta temporality on metrics.** Same as Claude Code self-hosted path — requires a `deltatocumulative` OTEL Collector processor before Prometheus. For Grafana Cloud direct OTLP ingestion, this is handled automatically.

7. **No active coding time.** `codex_turn_e2e_duration_ms` measures wall-clock turn time, not the semantic "active time" (time the user was engaged, subtracting idle). Claude Code's `active_time_seconds_total` has `type=user` and `type=cli` sub-types with different semantics.

### Workarounds Summary

| Gap | Best Workaround |
|---|---|
| Cost | Prometheus recording rule: token counts × pricing constants |
| Per-user metrics | Add Loki log ingestion; correlate logs+metrics by `conversation.id`; or accept team-level aggregates only |
| LOC/commits/PRs | Out of scope for OTel pipeline — git-level instrumentation needed |
| Language breakdown | Parse JSONL session files offline (ccusage-style), export to Pushgateway |
| mcp-server telemetry | Track upstream issue; no workaround today |

---

## Best Path to Get Codex Data into Prometheus / Grafana

**Grafana Cloud (recommended):** Configure three OTLP HTTP exporters (logs, metrics, traces) pointing to the Grafana Cloud OTLP gateway. The native [Grafana Cloud Codex integration](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-openai-codex/) provides three prebuilt dashboards immediately. Metrics arrive in Mimir (Prometheus-compatible), logs in Loki, traces in Tempo.

**Self-hosted Prometheus:** Route metrics through an OTEL Collector with `deltatocumulative` processor (same config as Claude Code self-hosted). Use `otlp-http` or `otlp-grpc` metrics exporter pointing at the collector. Logs require separate Loki deployment or parsing.

**Hybrid (ccusage-style local JSONL parse):** For cost attribution and session-level breakdowns, run a ccusage-style exporter that reads `~/.codex/sessions/*.jsonl` and pushes aggregated metrics to a Pushgateway. This fills the cost and user-identity gaps but adds operational complexity.

---

## Sources

- [Grafana Cloud OpenAI Codex integration](https://grafana.com/docs/grafana-cloud/monitor-infrastructure/integrations/integration-reference/integration-openai-codex/)
- [OpenAI Codex Configuration Reference](https://developers.openai.com/codex/config-reference)
- [OpenAI Codex Advanced Configuration](https://developers.openai.com/codex/config-advanced)
- [OpenAI Codex Sample Configuration](https://developers.openai.com/codex/config-sample)
- [PR #2103: OpenTelemetry events by vishnu-oai](https://github.com/openai/codex/pull/2103)
- [DeepWiki: Observability and Telemetry](https://deepwiki.com/openai/codex/9.4-observability-and-telemetry)
- [SigNoz: OpenAI Codex Monitoring with OpenTelemetry](https://signoz.io/docs/codex-monitoring/)
- [Oodle AI: OpenAI Codex Observability](https://docs.oodle.ai/ai-agent-observability/codex)
- [danielvaughan.com: Codex CLI OpenTelemetry (March 2026)](https://codex.danielvaughan.com/2026/03/28/codex-cli-opentelemetry-observability/)
- [danielvaughan.com: Codex CLI Observability Production Monitoring (April 2026)](https://codex.danielvaughan.com/2026/04/20/codex-cli-observability-opentelemetry-traces-metrics-production-monitoring/)
- [ccusage: Codex CLI Usage Analysis](https://ccusage.com/guide/codex/)
- [PixelPaw-Labs/codex-trace: Session JSONL viewer](https://github.com/PixelPaw-Labs/codex-trace)
- [LaoZhang AI Blog: How to Check Codex Token Usage](https://blog.laozhang.ai/en/posts/codex-token-usage)
