# Claude Code OpenTelemetry Telemetry Reference

**Date**: 2026-06-27  
**Source**: Official docs at [code.claude.com/docs/en/monitoring-usage](https://code.claude.com/docs/en/monitoring-usage) (fetched 2026-06-27), supplemented by community sources.  
**Scope**: Complete reference for metrics, log events, labels/attributes, config flags, and enhancement opportunities.

---

## 1. Metrics

All metrics are counters (monotonically increasing) exported via OTEL metrics protocol.  
**Naming note**: Claude Code uses dot notation internally (`claude_code.session.count`). When using Prometheus or Mimir, OTEL adds unit suffixes yielding names like `claude_code_session_count_total`. The table below shows both forms.

| OTEL Metric Name | Prometheus Name | Unit | Description | Key-specific Attributes |
|---|---|---|---|---|
| `claude_code.session.count` | `claude_code_session_count_total` | count | Sessions started | `start_type` |
| `claude_code.token.usage` | `claude_code_token_usage_tokens_total` | tokens | Tokens consumed per API request | `type`, `model`, `query_source`, `speed`, `effort`, `agent.name`, `skill.name`, `plugin.name`, `marketplace.name`, `mcp_server.name`, `mcp_tool.name` |
| `claude_code.cost.usage` | `claude_code_cost_usage_USD_total` | USD | Estimated cost per API request | `model`, `query_source`, `speed`, `effort`, `agent.name`, `skill.name`, `plugin.name`, `marketplace.name`, `mcp_server.name`, `mcp_tool.name` |
| `claude_code.lines_of_code.count` | `claude_code_lines_of_code_count_total` | count | Lines of code added or removed | `type`, `model` (v2.1.172+) |
| `claude_code.commit.count` | `claude_code_commit_count_total` | count | Git commits created | (standard attrs only) |
| `claude_code.pull_request.count` | `claude_code_pull_request_count_total` | count | Pull requests or merge requests created | (standard attrs only) |
| `claude_code.code_edit_tool.decision` | `claude_code_code_edit_tool_decision_total` | count | Edit/Write/NotebookEdit permission decisions | `tool_name`, `decision`, `source`, `language` |
| `claude_code.active_time.total` | `claude_code_active_time_seconds_total` | seconds | Active usage time (excludes idle) | `type` |

**Status**: All 8 metrics the plugin already tracks are confirmed accurate. No new metrics were added.

### Metric-specific attribute details

#### `claude_code.session.count`
- `start_type`: `"fresh"` | `"resume"` | `"continue"` | `"agents_view"` — the `"agents_view"` value identifies the `claude agents` dashboard process (a UI, not a conversational session); filter it out in dashboards

#### `claude_code.token.usage` and `claude_code.cost.usage`
- `type` (token only): `"input"` | `"output"` | `"cacheRead"` | `"cacheCreation"`
- `model`: model identifier, e.g. `"claude-sonnet-4-6"`
- `query_source`: `"main"` | `"subagent"` | `"auxiliary"` — category of subsystem that issued the request
- `speed`: `"fast"` when fast mode is active; absent otherwise
- `effort`: `"low"` | `"medium"` | `"high"` | `"xhigh"` | `"max"` — absent when model doesn't support effort levels
- `agent.name`: subagent type name; built-in and official-marketplace plugin agents appear verbatim; other user-defined names → `"custom"`; absent when not a named subagent
- `skill.name`: active skill name; built-in/user/official-marketplace appear verbatim; third-party → `"third-party"`; absent when no skill active
- `plugin.name`: owning plugin when active skill or subagent is from a plugin; official names verbatim; third-party → `"third-party"`; absent when no plugin
- `marketplace.name`: only emitted for official-marketplace plugins
- `mcp_server.name`: MCP server name if MCP tool ran; built-in/official names verbatim; user-configured → `"custom"`; absent when no MCP tool
- `mcp_tool.name`: same redaction as `mcp_server.name`

#### `claude_code.lines_of_code.count`
- `type`: `"added"` | `"removed"`
- `model`: model that made the change — **NEW in v2.1.172**, absent in earlier versions

#### `claude_code.code_edit_tool.decision`
- `tool_name`: `"Edit"` | `"Write"` | `"NotebookEdit"`
- `decision`: `"accept"` | `"reject"`
- `source`: `"config"` | `"hook"` | `"user_permanent"` | `"user_temporary"` | `"user_abort"` | `"user_reject"`
- `language`: programming language of edited file (e.g. `"TypeScript"`, `"Python"`, `"Markdown"`); `"unknown"` for unrecognized extensions

#### `claude_code.active_time.total`
- `type`: `"user"` (keyboard interactions) | `"cli"` (tool execution and AI responses)

---

## 2. Standard Attributes (All Metrics and Events)

These appear on every metric datapoint and every log event. Whether they appear in Prometheus as labels depends on cardinality control flags.

| Attribute | Description | Always Present | Controlled By |
|---|---|---|---|
| `session.id` | Unique session identifier | No | `OTEL_METRICS_INCLUDE_SESSION_ID` (default: `true`) |
| `app.version` | Claude Code version string | No | `OTEL_METRICS_INCLUDE_VERSION` (default: `false`) |
| `app.entrypoint` | Launch method: `cli`, `sdk-cli`, `sdk-ts`, `sdk-py`, `claude-vscode` | No | `OTEL_METRICS_INCLUDE_ENTRYPOINT` (default: `false`) |
| `organization.id` | Organization UUID when authenticated | When available | Always |
| `user.account_uuid` | Account UUID | When authenticated | `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` (default: `true`) |
| `user.account_id` | Account ID in tagged format matching Anthropic admin APIs (e.g. `user_01BWBeN28...`) | When authenticated | `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` (default: `true`) |
| `user.id` | Random anonymous identifier (persisted in `~/.claude.json`; no PII) | Always | Always |
| `user.email` | User email (OAuth auth only) | When authenticated via OAuth | Always |
| `terminal.type` | Terminal type: `iTerm.app`, `vscode`, `cursor`, `tmux`, etc. | When detected | Always |
| Custom keys | From `OTEL_RESOURCE_ATTRIBUTES` (e.g. `department`, `team.id`, `device`) | When set | `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES` (default: `true`) |

**Events additionally carry** (not on metrics — would cause unbounded cardinality):
- `prompt.id`: UUID v4 correlating all events from a single user prompt
- `workspace.host_paths`: host workspace directories (desktop app)

### Resource attributes on OTLP resource block

These are emitted on the OTLP resource, and promoted to datapoint labels when `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES=true`:

| Resource Attribute | Description | Notes |
|---|---|---|
| `service.name` | Always `"claude-code"` | |
| `service.version` | Claude Code version | Redundant with `app.version` |
| `os.type` | OS type: `linux`, `darwin`, `windows` | Useful for environment scene |
| `os.version` | OS version string | |
| `host.arch` | CPU architecture: `amd64`, `arm64` | |
| `wsl.version` | WSL version (Windows Subsystem for Linux only) | |

**Plugin note**: The Environment scene already uses `os.type` and `host.arch` — these are resource attributes promoted to labels, not direct metric labels like `model`.

---

## 3. Log Events (require `OTEL_LOGS_EXPORTER`)

Log events are separate from metrics and require configuring `OTEL_LOGS_EXPORTER`. They are NOT queryable from Prometheus/Mimir — they go to a logs backend (Loki, Elasticsearch, Loki, Grafana Cloud Logs, etc.).

### Event correlation

All events share `prompt.id` (UUID v4) which links every event produced while processing a single user prompt.

### Full event inventory

| Event Name | Trigger | Key Attributes | Privacy Gate |
|---|---|---|---|
| `claude_code.user_prompt` | User submits a prompt | `prompt_length`, `prompt`, `command_name`, `command_source` | `prompt` behind `OTEL_LOG_USER_PROMPTS`; `command_name` for custom/MCP behind `OTEL_LOG_TOOL_DETAILS` |
| `claude_code.api_request` | API request completes | `model`, `cost_usd`, `duration_ms`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `request_id`, `speed`, `query_source`, `effort`, `agent.name`, `skill.name`, `plugin.name`, `mcp_server.name`, `mcp_tool.name` | — |
| `claude_code.api_error` | API request fails after all retries | `model`, `error`, `status_code`, `duration_ms`, `attempt`, `request_id`, `speed`, `query_source`, `effort` | — |
| `claude_code.api_refusal` | API returns `stop_reason: "refusal"` | `model`, `request_id`, `query_source`, `speed`, `attempt`, `effort`, `server_fallback_hop`, `has_category`, `has_explanation`, `category` (gated) | `category` behind `OTEL_LOG_TOOL_DETAILS` |
| `claude_code.api_retries_exhausted` | All retry attempts exhausted | `model`, `error`, `status_code`, `total_attempts`, `total_retry_duration_ms`, `speed` | — |
| `claude_code.api_request_body` | Per API attempt when `OTEL_LOG_RAW_API_BODIES` set | `body`, `body_ref`, `body_length`, `body_truncated`, `model`, `query_source` | Requires `OTEL_LOG_RAW_API_BODIES` |
| `claude_code.api_response_body` | Per successful response when `OTEL_LOG_RAW_API_BODIES` set | `body`, `body_ref`, `body_length`, `body_truncated`, `model`, `query_source`, `request_id` | Requires `OTEL_LOG_RAW_API_BODIES` |
| `claude_code.tool_result` | Tool execution completes (only if accepted) | `tool_name`, `tool_use_id`, `success`, `duration_ms`, `error_type`, `decision_type`, `decision_source`, `tool_input_size_bytes`, `tool_result_size_bytes`, `mcp_server_scope`, `tool_parameters`, `tool_input` | `tool_parameters`/`tool_input` behind `OTEL_LOG_TOOL_DETAILS` |
| `claude_code.tool_decision` | Tool permission decision made | `tool_name`, `tool_use_id`, `decision`, `source`, `tool_parameters` | `tool_parameters` behind `OTEL_LOG_TOOL_DETAILS` |
| `claude_code.permission_mode_changed` | Permission mode changes | `from_mode`, `to_mode`, `trigger` | — |
| `claude_code.mcp_server_connection` | MCP server connects/disconnects/fails | `status`, `transport_type`, `server_scope`, `duration_ms`, `error_code`, `is_plugin`, `plugin_id_hash`, `plugin.name`, `server_name`, `error` | `server_name`/`error` behind `OTEL_LOG_TOOL_DETAILS` |
| `claude_code.auth` | `/login` or `/logout` completes | `action`, `success`, `auth_method`, `error_category`, `status_code` | — |
| `claude_code.internal_error` | Unexpected internal error caught | `error_name`, `error_code` | Not sent to Bedrock/Vertex/Foundry |
| `claude_code.plugin_installed` | Plugin finishes installing | `marketplace.is_official`, `install.trigger`, `plugin.name`, `plugin.version`, `marketplace.name` | `plugin.name`/`version`/`marketplace.name` behind `OTEL_LOG_TOOL_DETAILS` for third-party |
| `claude_code.plugin_loaded` | Plugin active at session start | `plugin.name`, `marketplace.name`, `plugin.version`, `plugin.scope`, `enabled_via`, `plugin_id_hash`, `has_hooks`, `has_mcp`, `host_owned_mcp`, `skill_path_count`, `command_path_count`, `agent_path_count`, `safe_mode` | `plugin.name` for non-official behind `OTEL_LOG_TOOL_DETAILS` |
| `claude_code.skill_activated` | Skill invoked (Claude or `/` command) | `skill.name`, `invocation_trigger`, `skill.source`, `skill.kind`, `plugin.name`, `marketplace.name` | `skill.name` for user-defined → `"custom_skill"` unless `OTEL_LOG_TOOL_DETAILS` |
| `claude_code.at_mention` | `@`-mention resolved in prompt | `mention_type`, `success` | — |
| `claude_code.hook_registered` | Hook configured at session start (inventory) | `hook_event`, `hook_type`, `hook_source`, `safe_mode`, `hook_matcher`, `plugin.name`, `plugin_id_hash` | `hook_matcher` behind `OTEL_LOG_TOOL_DETAILS` |
| `claude_code.hook_execution_start` | Hooks begin executing | `hook_event`, `hook_name`, `num_hooks`, `managed_only`, `hook_source`, `safe_mode` | — |
| `claude_code.hook_execution_complete` | All hooks for an event finish | `hook_event`, `hook_name`, `num_hooks`, `num_success`, `num_blocking`, `num_non_blocking_error`, `num_cancelled`, `total_duration_ms`, `managed_only`, `hook_source`, `safe_mode` | — |
| `claude_code.hook_plugin_metrics` | Official-marketplace plugin hook emits metrics | `plugin_id`, `hook_event`, + up to 20 plugin-defined numeric/boolean keys | Official marketplace only |
| `claude_code.compaction` | Conversation compaction completes | `trigger`, `success`, `duration_ms`, `pre_tokens`, `post_tokens`, `error`, `precompute_reuse` | `precompute_reuse` requires v2.1.153+ |
| `claude_code.feedback_survey` | Session quality survey shown/answered | `event_type`, `appearance_id`, `survey_type`, `response`, `enabled_via_override` | Requires `CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL` |

### Traces (beta — separate signal type)

Requires `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` plus `OTEL_TRACES_EXPORTER`. Span hierarchy:

```
claude_code.interaction
├── claude_code.llm_request
├── claude_code.hook                    (requires ENABLE_BETA_TRACING_DETAILED=1)
└── claude_code.tool
    ├── claude_code.tool.blocked_on_user
    └── claude_code.tool.execution
```

Key span attributes of note:
- `claude_code.llm_request`: `model`, `query_source`, `agent_id`, `parent_agent_id`, `speed`, `ttft_ms`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `stop_reason`, `gen_ai.*` semantic conventions
- `claude_code.tool`: `tool_name`, `tool_use_id`, `result_tokens`, `file_path` (gated), `full_command` (gated), `skill_name` (gated), `subagent_type` (gated)
- `claude_code.tool.blocked_on_user`: `duration_ms`, `decision`, `source`
- Subprocess `TRACEPARENT` env var is injected automatically so Bash scripts can parent their own spans

---

## 4. Configuration Flags Reference

### Core telemetry

| Env Var | Default | Description |
|---|---|---|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | off | Required to enable anything; set to `1` |

### Exporter selection

| Env Var | Options | Description |
|---|---|---|
| `OTEL_METRICS_EXPORTER` | `otlp`, `prometheus`, `console`, `none` | Where to send metrics (comma-separated for multiple) |
| `OTEL_LOGS_EXPORTER` | `otlp`, `console`, `none` | Where to send log events |
| `OTEL_TRACES_EXPORTER` | `otlp`, `console`, `none` | Where to send traces (beta) |

### OTLP endpoint/auth (apply to all signals unless overridden)

| Env Var | Description |
|---|---|
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` \| `http/json` \| `http/protobuf` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector endpoint |
| `OTEL_EXPORTER_OTLP_HEADERS` | Auth headers, e.g. `Authorization=Bearer token` |
| `OTEL_EXPORTER_OTLP_METRICS_PROTOCOL` | Overrides for metrics signal |
| `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` | Overrides for metrics signal |
| `OTEL_EXPORTER_OTLP_LOGS_PROTOCOL` | Overrides for logs signal |
| `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` | Overrides for logs signal |
| `OTEL_EXPORTER_OTLP_TRACES_PROTOCOL` | Overrides for traces signal |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Overrides for traces signal |

### Export intervals

| Env Var | Default | Description |
|---|---|---|
| `OTEL_METRIC_EXPORT_INTERVAL` | 60000ms | Metrics aggregation/export interval |
| `OTEL_LOGS_EXPORT_INTERVAL` | 5000ms | Log events batch export interval |
| `OTEL_TRACES_EXPORT_INTERVAL` | 5000ms | Span batch export interval (beta) |

### Temporality

| Env Var | Default | Description |
|---|---|---|
| `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` | `delta` | Set to `cumulative` for Grafana Cloud / Mimir |

### Cardinality control

| Env Var | Default | Description |
|---|---|---|
| `OTEL_METRICS_INCLUDE_SESSION_ID` | `true` | Include `session.id` on metric datapoints |
| `OTEL_METRICS_INCLUDE_VERSION` | `false` | Include `app.version` on metric datapoints |
| `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` | `true` | Include `user.account_uuid` and `user.account_id` |
| `OTEL_METRICS_INCLUDE_ENTRYPOINT` | `false` | Include `app.entrypoint` |
| `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES` | `true` | Promote `OTEL_RESOURCE_ATTRIBUTES` keys to datapoint labels |

### Content/privacy gates

| Env Var | Default | Description |
|---|---|---|
| `OTEL_LOG_USER_PROMPTS` | `0` | Enable logging of raw user prompt text on events |
| `OTEL_LOG_TOOL_DETAILS` | `0` | Enable Bash commands, MCP server/tool names, file paths, skill names in events and spans |
| `OTEL_LOG_TOOL_CONTENT` | `0` | Enable tool input/output content in trace spans (truncated at 60 KB); requires traces |
| `OTEL_LOG_RAW_API_BODIES` | off | `1` for inline JSON (truncated at 60 KB), `file:<dir>` for untruncated files on disk |

### Traces beta flags

| Env Var | Description |
|---|---|
| `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA` | Enable span tracing (`ENABLE_ENHANCED_TELEMETRY_BETA` also accepted) |
| `ENABLE_BETA_TRACING_DETAILED` | Enable `claude_code.hook` spans (requires allowlist for interactive CLI) |
| `BETA_TRACING_ENDPOINT` | Required alongside `ENABLE_BETA_TRACING_DETAILED` |
| `CLAUDE_CODE_PROPAGATE_TRACEPARENT` | Set to `1` if using custom `ANTHROPIC_BASE_URL` proxy and want trace context propagated |

### Resource/multi-team

| Env Var | Description |
|---|---|
| `OTEL_RESOURCE_ATTRIBUTES` | Comma-separated `key=value` pairs; common: `department=eng,team.id=platform,device=my-macbook,cost_center=eng-123` |
| `TRACEPARENT` | W3C trace context for non-interactive (`-p`) sessions — embed parent span |
| `TRACESTATE` | Additional trace state for non-interactive sessions |

### Authentication / mTLS

| Env Var | Description |
|---|---|
| `CLAUDE_CODE_CLIENT_CERT` | Client cert path (for `http/protobuf` or `http/json`) |
| `CLAUDE_CODE_CLIENT_KEY` | Client key path |
| `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE` | Key passphrase |
| `NODE_EXTRA_CA_CERTS` | Trust collector's CA for HTTP protocols |
| `OTEL_EXPORTER_OTLP_CLIENT_KEY` | Client key for gRPC |
| `OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE` | Client cert for gRPC |
| `OTEL_EXPORTER_OTLP_CERTIFICATE` | Trust collector's CA for gRPC |
| `CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS` | Dynamic header refresh interval (default 1740000ms / 29min) |

### Dynamic headers

Configure in `.claude/settings.json`:
```json
{ "otelHeadersHelper": "/path/to/script.sh" }
```
Script must output JSON with string key-value pairs for HTTP headers. Runs at startup and every 29 minutes.

### Other notable flags

| Env Var | Description |
|---|---|
| `CLAUDE_CODE_MAX_RETRIES` | API retry limit (default: 10, max: 15) |
| `CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL` | Force-enable feedback survey events for telemetry testing |
| `DISABLE_ERROR_REPORTING` | Suppress `claude_code.internal_error` events |

---

## 5. What the Plugin Already Knows vs What's Missing/New

### Confirmed accurate (plugin knowledge matches docs)
- All 8 metric names (Prometheus suffix form) are correct
- Labels on `code_edit_tool.decision`: `tool_name`, `decision`, `source`, `language` ✓
- `user_email`, `user_account_uuid`, `model`, `type`, `session_id` ✓
- `terminal_type` (docs use `terminal.type` → Prometheus converts dots to underscores) ✓
- `device` via `OTEL_RESOURCE_ATTRIBUTES="device=..."` ✓

### New attributes NOT currently used by the plugin

| Attribute | Metric(s) | Notes |
|---|---|---|
| `start_type` | `session.count` | `fresh`/`resume`/`continue`/`agents_view` — filter `agents_view` in dashboards |
| `query_source` | `token.usage`, `cost.usage` | `main`/`subagent`/`auxiliary` — break down by AI vs background tasks |
| `speed` | `token.usage`, `cost.usage` | `fast` vs normal — fast mode cost analysis |
| `effort` | `token.usage`, `cost.usage` | effort level (`low`→`max`) — available on newer models |
| `agent.name` | `token.usage`, `cost.usage` | subagent type attribution |
| `skill.name` | `token.usage`, `cost.usage` | skill attribution (built-in names verbatim) |
| `plugin.name` | `token.usage`, `cost.usage` | plugin attribution |
| `mcp_server.name` | `token.usage`, `cost.usage` | MCP server cost/token attribution |
| `mcp_tool.name` | `token.usage`, `cost.usage` | MCP tool cost/token attribution |
| `model` on LOC | `lines_of_code.count` | Added in v2.1.172 — enables per-model LOC breakdown |
| `organization.id` | All (standard) | Org-level filtering when authenticated |
| `user.account_id` | All (standard) | Tagged format ID matching Anthropic admin APIs |
| `app.entrypoint` | All (standard, opt-in) | `cli`/`sdk-cli`/`sdk-ts`/`sdk-py`/`claude-vscode` |
| `os.type` | All via resource | Already used in EnvironmentScene — resource attribute |
| `host.arch` | All via resource | Already used in EnvironmentScene — resource attribute |

### New events (logs only, not metrics — need logs backend)
`api_refusal`, `api_request_body`, `api_response_body`, `at_mention`, `hook_registered`, `hook_execution_start`, `hook_execution_complete`, `hook_plugin_metrics`, `compaction`, `feedback_survey`, `skill_activated`, `plugin_installed`, `plugin_loaded`

---

## 6. Enhancement Opportunities

### High value — available in existing metrics today

1. **Session type breakdown** (`start_type`): Add a breakdown panel in SessionsScene showing fresh vs resume vs continue sessions. Filter out `agents_view` from session counts. The existing session count metric has this label already — no new data collection needed.

2. **Fast mode cost/token analysis** (`speed`): Add a panel or annotation showing fast mode usage fraction. Relevant now that fast mode on Opus is available. Filter `speed="fast"` on cost/token metrics.

3. **Effort level breakdown** (`effort`): Once users set effort levels, `low`/`medium`/`high`/`xhigh`/`max` labels on cost/token metrics enable per-effort cost analysis. Currently absent for most models.

4. **Subagent vs main thread attribution** (`query_source`): Break down token/cost by `query_source` (`main`/`subagent`/`auxiliary`) to show how much usage is background tasks vs. interactive use. Useful for understanding true interactive cost.

5. **MCP tool cost attribution** (`mcp_server.name`, `mcp_tool.name`): Show cost breakdown by MCP server and tool — useful for teams using heavy MCP integrations. Requires `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES=true` (default).

6. **Model on LOC** (`model` on `lines_of_code.count`): Requires v2.1.172+. Enables breaking down lines added/removed by model, currently only approximable by joining against session/cost metrics.

7. **IDE/entrypoint breakdown** (`app.entrypoint`): Optional label showing `cli`/`vscode`/`sdk-ts` etc. Currently disabled by default (`OTEL_METRICS_INCLUDE_ENTRYPOINT=false`), but if enabled, enables richer EnvironmentScene breakdowns. Partially redundant with `terminal.type`.

8. **Session quality scores** (`feedback_survey` events): If logs are configured, surface user ratings and survey responses alongside session metrics (log query only, not Prometheus).

### Medium value — require logs backend (Loki/Grafana Cloud Logs)

9. **Compaction frequency and efficiency** (`compaction` events): `pre_tokens`/`post_tokens` shows context compression ratios. Track how often compaction is triggered and how much it reduces context. Loki + Grafana dashboard panel.

10. **API refusals monitoring** (`api_refusal` events): Count refusals by model, `has_category`, `server_fallback_hop`. Detect policy-sensitive usage patterns. Requires logs.

11. **Hook enforcement metrics** (`hook_execution_complete` events): `num_blocking` shows how often hooks block tool calls. Useful for security/policy dashboards.

12. **MCP server reliability** (`mcp_server_connection` events): Track `status=failed` and `error_code` to see which MCP servers are flaky.

13. **Skill usage tracking** (`skill_activated` events): Show which skills are most used, how triggered (`user-slash` vs `claude-proactive`), from which source. Requires `OTEL_LOG_TOOL_DETAILS` for user-defined skill names.

14. **Tool performance analysis** (`tool_result` events): P95 durations per tool type, failure rates by `error_type`. Requires logs backend.

### Lower value / specialist use cases

15. **Traces for latency breakdown**: The beta traces feature provides `ttft_ms` (time to first token), tool wait times, and permission decision wait times. Useful for performance troubleshooting but requires a Tempo/Jaeger backend.

16. **Plugin inventory** (`plugin_loaded` events): Fleet-wide plugin adoption monitoring. Useful for enterprise admins.

17. **Permission mode escalation alerts** (`permission_mode_changed` events): Security alerting for `bypassPermissions` mode changes.

---

## 7. Key Naming Notes for Prometheus/Grafana

The plugin already handles the OTEL-to-Prometheus name transformation:
- Dots → underscores
- Unit suffix appended: `count` → `_total`, `USD` → `_USD_total`, `tokens` → `_tokens_total`, `s` (seconds) → `_seconds_total`
- OTEL dot-notation attribute names become label names with underscores (e.g. `session.id` → `session_id`, `user.email` → `user_email`, `terminal.type` → `terminal_type`)

---

## Sources

- [Official Claude Code Monitoring Docs](https://code.claude.com/docs/en/monitoring-usage) — primary source, fetched 2026-06-27
- [General Analysis: Claude Code Control and Observability with OpenTelemetry](https://generalanalysis.com/guides/claude-code-control-observability-opentelemetry) — security event reference
- [SigNoz: Claude Code Monitoring with OpenTelemetry](https://signoz.io/docs/claude-code-monitoring/) — metrics/events reference table
- [SigNoz Blog: Bringing Observability to Claude Code](https://signoz.io/blog/claude-code-monitoring-with-opentelemetry/) — community guide
- [tcude.net: How I Monitor My Claude Code Usage with Grafana, OTel, and VictoriaMetrics](https://tcude.net/how-i-monitor-my-claude-code-usage-with-grafana-opentelemetry-and-victoriametrics/) — community configuration notes
- [AWS CloudWatch + Claude Code](https://aws.amazon.com/blogs/mt/analyzing-claude-code-usage-with-cloudwatch-and-opentelemetry/) — resource attribute label reference
- [Grafana Labs Dashboard: Claude Code Metrics](https://grafana.com/grafana/dashboards/25255-claude-code-metrics-prometheus/) — community dashboard reference
