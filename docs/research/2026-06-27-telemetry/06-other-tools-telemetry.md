# Other AI Coding Tools — Telemetry & Observability Survey

_Research date: 2026-06-27. Claude Code and OpenAI Codex CLI are used as reference columns in the comparison matrix but are not surveyed in depth here — see 01-claude-code-telemetry.md and 02-codex-telemetry.md._

---

## 1. OpenCode

OpenCode is an open-source, terminal-based AI coding agent (github.com/anomalyco/opencode) that gained significant traction as a Claude Code alternative in early 2026.

### 1.1 Telemetry

**Native OTEL:** No — as of 2026-06-27 native OTLP export is not shipped in mainline. Multiple open issues request it ([#14246](https://github.com/anomalyco/opencode/issues/14246), [#14697](https://github.com/anomalyco/opencode/issues/14697), [#12142](https://github.com/anomalyco/opencode/issues/12142), [#13171](https://github.com/anomalyco/opencode/issues/13171)) and at least one PR ([#5245](https://github.com/anomalyco/opencode/pull/5245)) attempts integration. Status is "in progress / community-driven."

**Plugin OTEL (recommended path):** The community plugin [DEVtheOPS/opencode-plugin-otel](https://github.com/DEVtheOPS/opencode-plugin-otel) (v0.9.0, 2026-05-01) exports full OTLP over gRPC or HTTP/protobuf and deliberately mirrors Claude Code's signal set. Multiple competing implementations exist ([pai4451/opencode-telemetry-plugin](https://github.com/pai4451/opencode-telemetry-plugin), [NeverMore93/opencode-otel](https://github.com/NeverMore93/opencode-otel), [gcornut/opencode-otel](https://github.com/gcornut/opencode-otel)).

### 1.2 Config (plugin)

| Env var | Purpose |
|---|---|
| `OPENCODE_ENABLE_TELEMETRY` | Enable plugin (required) |
| `OPENCODE_OTLP_ENDPOINT` | OTLP collector URL (e.g. `http://localhost:4317`) |
| `OPENCODE_OTLP_PROTOCOL` | `grpc`, `http/protobuf`, `http/json` |
| `OPENCODE_METRIC_PREFIX` | Rename metric prefix (default: `opencode.`) |
| `OPENCODE_OTLP_HEADERS` | Auth headers (comma-separated `key=value`) |
| `OPENCODE_RESOURCE_ATTRIBUTES` | OTel resource metadata (device, team, etc.) |
| `OPENCODE_DISABLE_METRICS` / `_LOGS` / `_TRACES` | Suppress signal types |

Plugin is loaded by adding `"@devtheops/opencode-plugin-otel"` to the OpenCode config.

### 1.3 Data available

| Signal | Details |
|---|---|
| **Tokens** | `opencode.token.usage` (Counter) — dimensions: input, output, reasoning, cache_read, cache_creation |
| **Cost** | `opencode.cost.usage` (Counter, USD) per message; `opencode.session.cost.total` (Histogram) |
| **Model** | `opencode.model.usage` (Counter) — messages per model/provider |
| **Sessions** | `opencode.session.count`, `opencode.session.duration` (Histogram) |
| **Tool calls** | `opencode.tool.duration` (Histogram); log events `tool_result`, `tool_decision` |
| **LOC** | `opencode.lines_of_code.count` (Counter — additions/deletions); `opencode.lines_of_code.total` (Gauge) |
| **Commits** | `opencode.commit.count` |
| **Other** | `opencode.message.count`, `opencode.retry.count`, `opencode.cache.count`, `opencode.session.token.total` |

Log events: `session.created`, `session.idle`, `session.error`, `user_prompt`, `api_request`, `api_error`, `commit`.

### 1.4 Ingest path into Prometheus

**Difficulty: 2/5.** Drop the plugin into OpenCode config → point `OPENCODE_OTLP_ENDPOINT` at an OTEL Collector with a `prometheus` exporter (or directly at Mimir's OTLP receiver). Identical pipeline to Claude Code. The metric shapes are explicitly designed to mirror Claude Code, so the same Grafana dashboards can be reused with minimal changes.

---

## 2. Gemini CLI

Google's official open-source AI coding CLI ([google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)) with native OTEL built-in.

### 2.1 Telemetry

**Native OTEL: Yes** — ships first-party, enabled via settings or env vars. Documented at [gemini-cli telemetry docs](https://google-gemini.github.io/gemini-cli/docs/cli/telemetry.html). Telemetry is **opt-in** by default (disabled unless configured). Emits metrics, logs, and traces; full content (prompts/responses) is off by default behind a separate flag.

### 2.2 Config

| Setting key (`.gemini/settings.json`) | Env var | Purpose |
|---|---|---|
| `telemetry.enabled` | `GEMINI_TELEMETRY_ENABLED` | Master on/off toggle |
| `telemetry.target` | `GEMINI_TELEMETRY_TARGET` | `otlp` or `file` |
| `telemetry.otlpEndpoint` | `GEMINI_TELEMETRY_OTLP_ENDPOINT` | Collector URL |
| `telemetry.otlpProtocol` | `GEMINI_TELEMETRY_OTLP_PROTOCOL` | `grpc` / `http/protobuf` / `http/json` |
| `telemetry.outfile` | `GEMINI_TELEMETRY_OUTFILE` | Local log file path |
| `telemetry.logPrompts` | `GEMINI_TELEMETRY_LOG_PROMPTS` | Capture prompt content (opt-in) |
| `telemetry.traces` | `GEMINI_TELEMETRY_TRACES_ENABLED` | Enable distributed traces |

Logs also write to `.gemini/telemetry.log` locally regardless of OTLP config.

### 2.3 Data available

**Metric names:**
- `gemini_cli.session.count` (Counter)
- `gemini_cli.token.usage` (Counter) — types: input, output, thought, cache, tool
- `gemini_cli.tool.call.count` (Counter)
- `gemini_cli.tool.call.latency` (Histogram, ms)
- `gemini_cli.api.request.count` (Counter)
- `gemini_cli.api.request.latency` (Histogram, ms)
- `gemini_cli.file.operation.count` (Counter)
- `gemini_cli.chat_compression` (Counter)
- `gen_ai.client.token.usage` (Histogram) — OTel GenAI semantic conventions
- `gen_ai.client.operation.duration` (Histogram, seconds)

**Log event names:** `gemini_cli.config`, `gemini_cli.user_prompt`, `gemini_cli.tool_call`, `gemini_cli.file_operation`, `gemini_cli.api_request`, `gemini_cli.api_response`, `gemini_cli.api_error`, `gemini_cli.flash_fallback`, `gemini_cli.slash_command`

**Key attributes:** `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `sessionId`, plus standard OTel GenAI convention attributes.

**Cost:** No native cost metric. Must derive from token counts using external rate tables. UNVERIFIED whether Google Cloud's managed OTLP pipeline adds cost fields automatically.

**LOC / commits:** Not tracked natively. Tool call count and file operation count are available.

### 2.4 Ingest path

**Difficulty: 2/5.** Set `GEMINI_TELEMETRY_OTLP_ENDPOINT` → standard OTEL Collector → Prometheus/Mimir. Well-documented, production-tested. Google Cloud's OTLP endpoint is also directly supported without a collector. Grafana Labs published pre-configured monitoring dashboards for Gemini CLI as of 2026-03-23 ([Instant insights blog post](https://cloud.google.com/blog/topics/developers-practitioners/instant-insights-gemini-clis-new-pre-configured-monitoring-dashboards)). Note: no `cost` metric means a recording rule must multiply token counts by per-model rates.

---

## 3. Aider

Aider ([aider.chat](https://aider.chat)) is a terminal-based AI pair programmer with a long track record but minimal observability investment.

### 3.1 Telemetry

**Native OTEL: No.** Aider uses PostHog for anonymous usage analytics, and the data flow goes to PostHog's cloud (or a custom PostHog instance), not to any OTLP backend. Telemetry is **opt-in**; users must pass `--analytics` explicitly (or accept during first run). All collection points are visible in open source code on GitHub.

### 3.2 Config

| Flag / Key | Purpose |
|---|---|
| `--analytics` | Enable opt-in analytics |
| `--no-analytics` | Disable for session |
| `--analytics-disable` | Permanently disable |
| `--analytics-log <file>` | Write analytics events to JSONL file locally |
| `--analytics-posthog-project-api-key` | Route to own PostHog project |
| `--analytics-posthog-host` | Custom PostHog host URL |

### 3.3 Data available

- Model used, token counts (UNVERIFIED: whether per-request or session totals)
- Edit format (whole/diff/udiff/architect, etc.)
- Feature and command usage
- Exceptions and error types
- No cost tracking, no LOC delta, no tool-decision tracking

The `--analytics-log` flag produces JSONL output locally, which is the only realistic path to custom ingestion. No published schema for the JSONL format was found.

### 3.4 Ingest path

**Difficulty: 5/5 (not feasible for production).** No OTEL, no Prometheus endpoint. Only option is to scrape the `--analytics-log` JSONL file with a custom log-to-metrics agent (e.g., a Loki pipeline + recording rules, or a bespoke exporter). Aider shows no indication of adding OTEL support. The PostHog analytics are privacy-first and not designed as a monitoring data source.

---

## 4. Cline

Cline ([cline.bot](https://cline.bot)) is a VS Code extension AI coding agent. Roo Code, a popular fork, was shut down and archived in May 2026; its telemetry story is moot.

### 4.1 Telemetry

**Two separate systems:**

1. **Anonymous telemetry (all tiers):** PostHog-based, opt-out via VS Code settings (`cline.telemetryEnabled: false`). Collects interaction patterns, feature usage, error rates. No code or prompt content. Documented at [Cline telemetry docs](https://docs.cline.bot/more-info/telemetry).

2. **Enterprise OTEL export:** Opt-in, requires Remote Configuration from the Cline Business/Enterprise dashboard. Exports over OTLP (gRPC, HTTP/protobuf, or HTTP/json) to any OTel-compatible backend. Documented at [Cline OTel docs](https://docs.cline.bot/enterprise-solutions/monitoring/opentelemetry).

**Known issue (2026):** A [reported bug (#8348)](https://github.com/cline/cline/issues/8348) shows metrics being routed to `otel.cline.bot` despite custom `OTEL_EXPORTER_OTLP_ENDPOINT` configuration. Status UNVERIFIED as of 2026-06-27.

### 4.2 Config (Enterprise OTEL)

Configured via the Cline Remote Configuration dashboard, not environment variables. Settings include:
- OTLP endpoint URL
- Protocol (gRPC / HTTP/protobuf / HTTP/JSON)
- TLS opt-out for gRPC
- Separate enable/disable for logs and metrics
- Auth headers (key-value pairs)
- Metrics export interval
- Log batch size, timeout, max queue size

Debug env var: `TEL_DEBUG_DIAGNOSTICS=true`

### 4.3 Data available

The Enterprise OTEL documentation lists general categories only — specific metric names are not publicly documented:
- Feature usage counts
- Task execution metrics
- Error rates and types
- Performance measurements
- Anonymous aggregate data (no code, paths, or prompt content)

Token usage and cost tracking have been requested by the community ([issue #4540](https://github.com/cline/cline/issues/4540)) but are not confirmed as OTel exports. UNVERIFIED whether the enterprise tier now exposes per-request token/cost metrics.

### 4.4 Ingest path

**Difficulty: 3/5.** Enterprise OTEL path is straightforward if you have a Cline Business/Enterprise subscription and a working OTel Collector. The opaque metric schema and the routing bug introduce risk. Free-tier users have no OTEL access; PostHog data is inaccessible for self-hosted ingest.

---

## 5. Cursor

Cursor ([cursor.com](https://cursor.com)) is a full IDE fork of VS Code with AI features deeply integrated. It is now one of the most widely deployed AI coding tools in enterprise engineering.

### 5.1 Telemetry

**Native OTEL: No.** Cursor does not expose an OTLP endpoint or any standard observability protocol. All analytics are proprietary, surfaced through Cursor's own dashboard and Admin API.

### 5.2 Config / Access

Analytics are available in the Cursor dashboard for Business and Enterprise plans. Key details:
- Rolling window of recent activity in the UI
- CSV export supported
- **Admin API** (programmatic access) available for Enterprise customers only
- No standard env vars for OTEL configuration

### 5.3 Data available

Through the Cursor analytics dashboard and API:
- AI-generated lines of code (per user, per repo)
- Tab completions count, Agent edits, Chat prompt counts
- Daily active users, monthly active users
- Repository-level AI code commit attribution
- Cloud Agent metrics (agents created, PRs opened/merged)
- Work classification (Enterprise tier)
- Model used per session (UNVERIFIED: whether this is API-accessible)

**Not available:** Per-request token counts, per-request cost, raw tool decisions, session duration — these do not appear in public documentation.

### 5.4 Ingest path

**Difficulty: 5/5 (not feasible without Enterprise + custom integration).** No standard ingest path. An Enterprise customer could poll the Cursor Admin API and write a custom Prometheus exporter. The API shape is not publicly documented. This is expensive and operationally fragile.

---

## 6. GitHub Copilot (VS Code Chat)

GitHub Copilot spans multiple surfaces. Two distinct telemetry systems exist:

**A) VS Code Copilot Chat (OTel — IDE agent monitoring)**
**B) GitHub Copilot REST API (usage reporting — org/enterprise level)**

### 6.1 Telemetry

**A — VS Code OTel: Yes (opt-in).** Copilot Chat in VS Code emits traces, metrics, and events via OTel for agent interactions, LLM calls, tool execution, and token usage. Signal names follow OTel GenAI Semantic Conventions. Documented at [VS Code agent monitoring guide](https://code.visualstudio.com/docs/agents/guides/monitoring-agents) and [vscode-copilot-chat monitoring docs](https://github.com/microsoft/vscode-copilot-chat/blob/main/docs/monitoring/agent_monitoring.md).

**B — REST API: Yes.** GitHub provides org/enterprise-scoped usage metrics via REST API. The older copilot-usage endpoint was closed 2026-04-02; the current [copilot-metrics API](https://docs.github.com/en/rest/copilot/copilot-metrics) is the replacement. Team-level metrics added 2026-05-14.

### 6.2 Config

**VS Code OTel (settings.json / env vars):**

| Setting | Env var | Purpose |
|---|---|---|
| `github.copilot.chat.otel.enabled` | `COPILOT_OTEL_ENABLED` | Master toggle (default: off) |
| `exporterType` | — | `otlp-http`, `otlp-grpc`, `console`, `file` |
| OTLP endpoint | `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector URL |
| — | `OTEL_SERVICE_NAME` | Service name tag |
| `captureContent` | `COPILOT_OTEL_CAPTURE_CONTENT` | Capture prompts/responses (off by default) |

**REST API:** Requires OAuth or PAT with `manage_billing:copilot` or `read:enterprise` scope. Enterprise/org/team/user endpoints available.

### 6.3 Data available

**VS Code OTel metrics:**
- `gen_ai.client.operation.duration` (Histogram) — OTel GenAI standard
- `copilot_chat.tool.call.count` (Counter)
- `copilot_chat.session.count` (Counter)
- Attributes: `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.request.model`, `gen_ai.provider.name`, `gen_ai.tool.name`, `copilot_chat.edit.source`, `gen_ai.conversation.id`, `error.type`

**REST API (org/enterprise aggregates):**
- Acceptance counts and rates by model, language, IDE
- Lines of code generated / accepted
- Active users, total interactions
- No per-user token counts in public-tier API (aggregate only)

**GitHub-level Grafana dashboard** exists ([Grafana Labs dashboard #25053](https://grafana.com/grafana/dashboards/25053-github-copilot/)), built on the REST API via a community Prometheus exporter ([ehrnst/GitHub-copilot-metrics-prometheus](https://github.com/ehrnst/GitHub-copilot-metrics-prometheus)).

### 6.4 Ingest path

**VS Code OTel path — Difficulty: 3/5.** Telemetry is per-developer, opt-in in VS Code. Requires each developer to configure their VS Code to point at a shared OTEL Collector. No centralized push config. Operationally complex at scale.

**REST API path — Difficulty: 2/5.** A Prometheus exporter polls the GitHub API and exposes metrics for scraping. Multiple community exporters exist. Requires GitHub org with Copilot Business/Enterprise. Data is org-level aggregate, not per-session.

---

## 7. Continue.dev

Continue ([continue.dev](https://continue.dev)) was an open-source VS Code / JetBrains AI coding extension. **Status as of 2026: Effectively end-of-life for the open-source project.** Continue was acquired by Cursor in 2026. The final v2.0.0 release (archived) explicitly removed all anonymous telemetry and stripped out authentication before the repository was made read-only.

### 7.1 Telemetry

**Native OTEL: No.** The pre-2.0 versions used PostHog for anonymous telemetry (opt-out via `allowAnonymousTelemetry: false` in config). v2.0.0 removed this entirely. No OTEL export was ever implemented.

### 7.2 Data available

None from a self-hosted perspective. The tool is no longer maintained, and the telemetry that existed was PostHog-only, Posthog-cloud only.

### 7.3 Ingest path

**Difficulty: 5/5 — not feasible.** Project is archived. No recommended path.

---

## Cross-Tool Comparison Matrix

| Tool | Native OTEL | Tokens | Cost | Model | Sessions | Tool Decisions | LOC | Ingest Difficulty (1=easy, 5=skip) |
|------|-------------|--------|------|-------|----------|----------------|-----|------|
| **Claude Code** (reference) | Yes | Yes | Yes | Yes | Yes | Yes (language) | Yes | 1 |
| **OpenAI Codex CLI** (reference) | Yes | Yes | Yes | Yes | Yes | Yes | No | 2 |
| **Gemini CLI** | Yes | Yes | No (derive) | Yes | Yes | Yes (count) | No | 2 |
| **OpenCode** (via plugin) | Yes (plugin) | Yes | Yes | Yes | Yes | Yes | Yes | 2 |
| **GitHub Copilot** (VS Code OTel) | Yes (opt-in/user) | Yes | No | Yes | Yes | Yes | No | 3 |
| **GitHub Copilot** (REST API) | No (API poll) | No (aggregates) | No | Yes | Yes | Yes (accept rate) | Yes (accepted LOC) | 2 |
| **Cline** (Enterprise) | Yes (Enterprise tier) | Unverified | Unverified | Unverified | Unverified | Unverified | No | 3 |
| **Aider** | No | Partial (PostHog) | No | Yes | No | No | No | 5 |
| **Cursor** | No | No | No | Unverified | Yes | No | Yes (AI LOC) | 5 |
| **Continue.dev** | No | No | No | No | No | No | No | 5 (archived) |
| **Roo Code** | N/A | N/A | N/A | N/A | N/A | N/A | N/A | 5 (shut down) |

---

## Ranked Shortlist: Easiest to Add Next

### Tier 1 — Add now (low effort, strong signal)

**1. Gemini CLI**
Native OTEL, well-documented, Google-maintained, pre-built Grafana dashboards already exist for it. Token type breakdown (input/output/thought/cache/tool) is richer than Claude Code's. Only gap is cost (must derive from token rates). The `gemini_cli.*` metric namespace is clean and stable. A single OTEL Collector instance can ingest both Claude Code and Gemini CLI simultaneously with no new infrastructure. Config is ~3 env vars per developer.

**2. OpenCode (via DEVtheOPS plugin)**
The plugin explicitly mirrors Claude Code's metric shapes. If this plugin is running, the existing Claude Stats dashboards need only minor label adjustments to display OpenCode data alongside Claude Code data. OpenCode's growing user base (especially developers wanting open-source alternative to Claude Code) makes this a high-value target. Plugin v0.9.0 is stable and actively maintained.

### Tier 2 — Add conditionally (moderate effort or limited data)

**3. GitHub Copilot (REST API path)**
The data is aggregate (org-level) rather than per-session, but the acceptance rate, active users, and accepted LOC metrics are genuinely useful for mixed-tool teams. Multiple Prometheus exporters already exist; one could be deployed as a Grafana datasource or a sidecar scraper. Requires GitHub org with Copilot Business/Enterprise. Best treated as a "team adoption" data source rather than a session-level one.

**4. GitHub Copilot (VS Code OTel path)**
Richer per-session data including per-model token counts, but operationally complex: requires per-developer VS Code config change. Better suited for teams with centralized VS Code settings management (e.g., enterprise dev container setups).

### Tier 3 — Defer or skip

- **Cline (Enterprise):** Viable in theory but the undocumented metric schema, the routing bug, and the enterprise-tier gate make it risky to build a dashboard against. Revisit once metric names are publicly documented.
- **Aider:** JSONL scraping path is brittle; upstream shows no interest in adding OTEL. Skip.
- **Cursor:** No public OTEL. Admin API is Enterprise-only and undocumented. Skip.
- **Continue.dev / Roo Code:** Both archived. Skip.

---

## Sources

- [OpenCode OTEL Plugin (DEVtheOPS)](https://github.com/DEVtheOPS/opencode-plugin-otel)
- [OpenCode native OTEL issue #14246](https://github.com/anomalyco/opencode/issues/14246)
- [awesome-opencode plugin list](https://github.com/awesome-opencode/awesome-opencode)
- [OpenCode OTEL observability — SigNoz](https://signoz.io/docs/opencode-observability/)
- [Gemini CLI telemetry docs (official)](https://google-gemini.github.io/gemini-cli/docs/cli/telemetry.html)
- [Gemini CLI telemetry.md — GitHub](https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/telemetry.md)
- [Gemini CLI GenAI metrics PR #10343](https://github.com/google-gemini/gemini-cli/pull/10343)
- [Instant insights: Gemini CLI dashboards — Google Cloud Blog](https://cloud.google.com/blog/topics/developers-practitioners/instant-insights-gemini-clis-new-pre-configured-monitoring-dashboards)
- [Monitor Gemini CLI with OpenTelemetry — DEV Community](https://dev.to/agardnerit/monitor-gemini-cli-using-opentelemetry-for-realtime-usage-statistics-3adi)
- [Aider analytics docs](https://aider.chat/docs/more/analytics.html)
- [Cline telemetry docs](https://docs.cline.bot/more-info/telemetry)
- [Cline OTel enterprise docs](https://docs.cline.bot/enterprise-solutions/monitoring/opentelemetry)
- [Cline OTel routing bug #8348](https://github.com/cline/cline/issues/8348)
- [Cline token analytics request #4540](https://github.com/cline/cline/issues/4540)
- [Roo Code vs Cline comparison (Roo Code shutdown note)](https://www.qodo.ai/blog/roo-code-vs-cline/)
- [Cursor analytics docs](https://cursor.com/docs/account/teams/analytics)
- [Jellyfish: Cursor analytics overview](https://jellyfish.co/library/cursor-usage-analytics/)
- [VS Code Copilot Chat OTel monitoring guide](https://code.visualstudio.com/docs/agents/guides/monitoring-agents)
- [vscode-copilot-chat monitoring docs — GitHub](https://github.com/microsoft/vscode-copilot-chat/blob/main/docs/monitoring/agent_monitoring.md)
- [GitHub Copilot OTel SDK docs](https://docs.github.com/en/copilot/how-tos/copilot-sdk/observability/opentelemetry)
- [GitHub Copilot metrics API (current)](https://docs.github.com/en/rest/copilot/copilot-metrics)
- [GitHub Copilot team metrics API — changelog 2026-05-14](https://github.blog/changelog/2026-05-14-team-level-copilot-usage-metrics-now-available-via-api/)
- [GitHub Copilot Grafana dashboard #25053](https://grafana.com/grafana/dashboards/25053-github-copilot/)
- [copilot-metrics-prometheus exporter (ehrnst)](https://github.com/ehrnst/GitHub-copilot-metrics-prometheus)
- [Continue.dev telemetry](https://docs.continue.dev/advanced/telemetry)
- [Continue.dev v2.0 / Cursor acquisition context](https://vibecoding.app/blog/continue-dev-review)
- [VictoriaMetrics vibe coding observability](https://victoriametrics.com/blog/vibe-coding-observability/)
- [Dash0: New AI integrations including OpenCode](https://www.dash0.com/changelog/new-ai-integrations-opencode-langchain-kagent-openlit-and-kiro)
