# Claude Stats - Grafana App Plugin

## Overview

Claude Stats is a Grafana app plugin that provides team visibility into Claude Code usage metrics. It leverages Claude Code's built-in OpenTelemetry support to collect and visualize usage data in Grafana.

## Architecture

### Data Flow

**Grafana Cloud (recommended):**
```
Claude Code → OTLP Export → Grafana Cloud (Mimir) → This App
     ↓              ↓                ↓
  Metrics      Cumulative       Grafana Scenes
```

**Self-hosted (requires collector):**
```
Claude Code → OTLP Export → OTEL Collector → Prometheus → This App
     ↓              ↓              ↓              ↓
  Metrics      HTTP/Protobuf   Delta→Cumulative  Grafana Scenes
```

### Technology Stack

- **Frontend**: React with Grafana Scenes framework
- **Data Sources**: Prometheus (or Mimir) for metrics
- **Package Manager**: npm
- **Build Tool**: Webpack (via @grafana/plugin-tools)
- **Target Platform**: Grafana Cloud (v12.3.0+) or self-hosted Grafana

### Key Dependencies

- `@grafana/scenes` - Scene-based UI framework
- `@grafana/data`, `@grafana/ui`, `@grafana/runtime` - Grafana frontend libraries
- `react-router-dom` v6 - Routing

## Project Structure

```
src/
├── components/
│   ├── App.tsx              # Main router component
│   ├── AppConfig.tsx        # Plugin configuration page (setup guide, troubleshooting)
│   └── scenes/
│       └── SceneAppPage.tsx # Main Scenes app with tab navigation
├── scenes/
│   ├── queries.ts           # PromQL query definitions
│   ├── variables.ts         # Shared scene variables (datasource, filters)
│   └── pages/
│       ├── OverviewScene.ts   # Overview dashboard scene
│       ├── CostsScene.ts      # Cost analytics scene
│       ├── TokensScene.ts     # Token usage scene
│       ├── ToolsScene.ts      # Tool usage scene
│       ├── ProductivityScene.ts # Productivity metrics scene
│       ├── SessionsScene.ts     # Session analytics scene
│       ├── LanguagesScene.ts    # Language analytics scene
│       └── EnvironmentScene.ts  # Environment analytics scene
├── types.ts                 # TypeScript types
├── constants.ts             # Metric names, labels, routes
├── module.ts                # Plugin entry point
└── plugin.json              # Plugin metadata
```

## Implemented Features

### Dashboard Scenes

1. **Overview** - High-level stats (total cost, tokens, sessions, active users) with cost and token trend charts
2. **Costs** - Cost breakdown by model and team member, daily trends, cost distribution pie charts, detailed table
3. **Tokens** - Token usage by type (input/output/cacheRead/cacheCreation), model distribution, usage over time
4. **Tools** - Tool acceptance rate, tool decisions (accept/reject), usage by tool name, decisions over time
5. **Productivity** - Lines of code (added/removed), commits, pull requests, active time by team member
6. **Sessions** - Session count, per-session averages, session trends, intensity, and device/model breakdowns
7. **Languages** - Programming language distribution from code-edit tool decisions, language usage trends over time, acceptance rate by language, language usage by team member/device
8. **Environment** - OS distribution, architecture, IDE/terminal usage, Claude Code version adoption, device breakdown, cost breakdown by IDE and OS, usage trends over time

### Configuration Page

All setup and configuration is consolidated in the plugin Configuration page (Administration > Plugins > Claude Stats > Configuration):

- **Setup Guide tab**: Step-by-step instructions for configuring Claude Code OpenTelemetry export with credential input and generated shell script
- **Troubleshooting tab**: Common issues, metrics reference, documentation links

### Team Filtering

- QueryVariable for filtering by `user_email` (team members identified by email address)
- CustomVariable for filtering by `provider` (model family: Claude, GPT, GLM, Review, Other)
- QueryVariable for filtering by `model`, cascading from the selected provider
- QueryVariable for filtering by `terminal_type` (IDE/Terminal: vscode, cursor, iTerm, tmux, etc.)
- QueryVariable for filtering by `os_type` (darwin, linux, windows)
- QueryVariable for filtering by `device` (custom device name via OTEL_RESOURCE_ATTRIBUTES)
- All scenes support filtering to individual team members, models, IDEs, OS, and devices
- "All" option for aggregate views

### Provider-Aware Model Analytics

Models are grouped into provider families so the dashboards stay readable as
non-Anthropic models appear (the live datasource carries 34 distinct `model`
values across Claude, GPT, GLM, and review models).

- **Rule table** — `MODEL_FAMILIES` in `src/constants.ts` is the single
  definition point: an ordered list of `{ key, display, match }`, plus an
  `OTHER_FAMILY` catch-all. Nothing else may hard-code a family name or regex.
- **Derivation** — `withProviderLabel()` in `src/scenes/queries.ts` wraps an
  expression in a chained `label_replace` that assigns the catch-all innermost
  and each named rule outside it, in table order. Order is load-bearing:
  reversing it silently classifies everything as `Other`.
- **Filtering** — `PROVIDER_FILTERS` exposes one matcher fragment per family,
  injected into query selectors as `${provider:raw}`. The catch-all fragment is
  a negated `!~` over the alternation of every named rule, because Prometheus
  RE2 has no negative lookahead.
- **Cascade** — selecting a provider narrows the `$model` dropdown via the same
  `${provider:raw}` fragment inside `label_values`. `getSharedVariables()`
  installs an activation handler that resets `$model` to All when the new
  family excludes the current selection; Scenes does not do this itself for
  URL-synced variables.

**Regexes are fully anchored in Prometheus.** A family rule must describe the
whole model string — `.*claude.*`, not `claude.*`, or the live
`anthropic/claude-*` values fall through to the catch-all.

**Only apply the provider filter to metrics that carry a `model` label.**
Filtering a model-less metric by a named provider matches nothing and empties
the panel, while "All" sweeps it into the catch-all.

| Carries `model` | Does NOT carry `model` |
|---|---|
| `claude_code_cost_usage_USD_total`, `claude_code_token_usage_tokens_total`, `claude_code_lines_of_code_count_total` | `claude_code_session_count_total`, `claude_code_commit_count_total`, `claude_code_pull_request_count_total`, `claude_code_active_time_seconds_total`, `claude_code_code_edit_tool_decision_total` |
| every `codex_*` metric used by this plugin — including `codex_guardian_review_total`, `codex_tool_call_total` and `codex_sse_event_total` | — |

**Verify label presence against the datasource, not against the "notable
labels" column of
`docs/research/2026-06-27-telemetry/03-real-data-inventory.md`** — that column
is a summary, not an exhaustive schema. It omits `model` on several `codex_*`
families that do in fact carry it. The check that actually settles it:

```
count(count by (model) (increase(<metric>{model!=""}[90d])))
```

An empty result means no `model` label; a count means that many distinct
values. Note an instant query is not enough — several `codex_*` counters are
stale at `now` and need the range form above.

`costTableByDevice` deliberately keeps raw-model grouping — a table is
scannable, so per-model rows are the point — while still gaining the filter.
`sessionsByModel` deliberately keeps raw-model grouping because its Claude
metric has no `model` dimension to group on.

### Data Source Discovery

- DataSourceVariable for Prometheus auto-discovery
- Supports multiple Prometheus-compatible data sources

### Estimated Codex Cost

**Codex emits no cost metric.** `codex_turn_token_usage_sum` carries token
counts and nothing else, so every Codex dollar figure in this plugin is
DERIVED — tokens times a published price table — and is labelled as an
estimate wherever it appears. Claude Code cost is measured
(`claude_code_cost_usage_USD_total`) and is never touched by any of this.

- **Price data** — extracted from LiteLLM's
  `model_prices_and_context_window.json`
  (https://github.com/BerriAI/litellm), MIT licensed; the notice is retained
  at `src/pricing/LICENSE.litellm`.
- **Snapshot** — `src/pricing/price-snapshot.json` is committed, not fetched
  at build time, so the bundle is reproducible and offline and a price change
  arrives as a reviewable diff. It carries its own `asOf` date; that date, not
  the build date, is what the UI renders.
- **Refresh** — `npm run update-prices` regenerates the snapshot by hand. It is
  deliberately NOT wired into `npm run build`. Pass `--as-of YYYY-MM-DD` to pin
  the date. Output is deterministic (keys sorted, fixed formatting), so an
  unchanged upstream re-run diffs only on `asOf`.
- **Live refresh** — off by default, opt in on the plugin Configuration page
  under the Pricing tab. While off the plugin issues NO outbound request for
  price data. The enable flag is read with `=== true`, because `jsonData`
  round-trips through hand-edited provisioning YAML where the string `"false"`
  would otherwise be truthy.
- **Provenance** — `snapshot` (shipped table), `live` (feed used), `fallback`
  (refresh enabled but the feed was unreachable or malformed). `fallback` is
  deliberately distinct from `snapshot`: a blocked refresh must not be
  presentable as a chosen default. The Codex tab surfaces which is in use.

#### Three rules that are cheap to get wrong and expensive to ship wrong

**1. `input` is GROSS and already contains `cached_input`.** Fresh input must
be derived by subtraction:

```
fresh_input = max(0, input - cached_input)
cost = fresh_input * input_cost_per_token
     + cached_input * cache_read_input_token_cost
     + output * output_cost_per_token
```

Charging `input` at the input rate AND `cached_input` at the cache-read rate
bills ~95% of all Codex tokens twice. On the live 30d window that is $3,039
instead of the correct $399 — a 7.6x overstatement.

**2. Only `input`, `cached_input` and `output` are billable.**
`codex_turn_token_usage_sum` carries six `token_type` values, and three of them
are traps. Measured over 90d on every model without exception:

| Relationship | Consequence |
|---|---|
| `total == input + output` | `total` is a partial sum, not a fourth type |
| `cached_input <= input` | a subset, ~95% of input |
| `reasoning_output <= output` | a subset of output |
| `cache_write_input == 0` | present, always zero |
| `non_cached_input` | absent from this metric entirely |

`CODEX_BILLABLE_TOKEN_TYPES` in `src/constants.ts` is the single definition
point. Both the query selector and `estimateCost()` exclude the rest —
belt-and-braces, so the double-counting trap is not a single point of failure.

**3. A model is priced only when all three rates are present.** A partial entry
goes to the unpriced bucket rather than borrowing a substitute rate. No special
cases, no invented numbers.

#### Model-key matching

**Exact string match** of the `model` label against the price-table key set
filtered to `litellm_provider == "openai"`. No prefix strip, no normalization.
Codex reports bare model ids (`gpt-5.6-sol`) which match that key set directly.

A `chatgpt/` prefix fallback was evaluated and rejected: the only live value it
would reach (`chatgpt/gpt-5.3-codex-spark`) carries no cost fields, so it stays
unpriced under rule 3 either way.

As of 2026-08-19, 6 of 8 live model values match, covering ~89% of billable
Codex tokens. The unmatched ones are `codex-auto-review` — a synthetic label
for Codex's own review pass, not an OpenAI catalogue model, and not expected to
gain a price — and `gpt-5.3-codex-spark`. Their volume is surfaced as
**Unpriced Tokens** on the Codex tab so an understated total is visibly
understated.

#### Only count series still live at the end of the window

Grafana's Prometheus datasource returns one frame per series with its OWN time
axis; it does not pad them onto a shared grid. A model that went idle mid-window
simply ends early, and `increase(...[$__range])` for it is zero over the
trailing window. Reducing with "last non-null value" instead resurrects its last
recorded total as if current — that revived `gpt-5.3-codex-spark` after 20 idle
days and inflated unpriced volume from 68.9M to 80.5M. Compare each series
against the window end taken across ALL frames.

#### Where it surfaces

| Panel | Scene |
|---|---|
| Estimated Codex Cost, Unpriced Tokens, Price Table | Codex |
| Total Cost * (Claude measured + Codex estimated) | Overview, Costs |

Panels that break cost down by a label Codex does not emit (`user_email`,
`terminal_type`, `os_type`, `device`) cannot meaningfully blend — that is why
`CODEX_CONTEXT_FILTER` exists separately from `ENV_FILTERS`. They stay
Claude-only and say so in their description rather than silently dropping the
Codex share.

## Claude Code Metrics Reference

These metrics are exported by Claude Code when OTLP is enabled. Note that OTEL adds unit suffixes to metric names:

| Metric | Description |
|--------|-------------|
| `claude_code_session_count_total` | Number of Claude Code sessions |
| `claude_code_cost_usage_USD_total` | API costs in USD |
| `claude_code_token_usage_tokens_total` | Token consumption by type |
| `claude_code_lines_of_code_count_total` | Lines added/removed |
| `claude_code_commit_count_total` | Git commits made |
| `claude_code_pull_request_count_total` | Pull requests created |
| `claude_code_active_time_seconds_total` | Active coding time in seconds |
| `claude_code_code_edit_tool_decision_total` | Tool accept/reject decisions |

**Codex emits no equivalent of `claude_code_cost_usage_USD_total`.** It has no
cost metric at all — `codex_turn_token_usage_sum` carries token counts only,
which is why Codex cost is estimated. See "Estimated Codex Cost" above.

| Codex metric | Description |
|--------------|-------------|
| `codex_turn_token_usage_sum` | Token consumption by `token_type` and `model`. NO cost counterpart. |

### Labels

- `user_email` - User's email address (primary identifier for team members)
- `user_account_uuid` - Anonymized user identifier (for privacy-sensitive deployments)
- `model` - Model used (e.g., claude-sonnet-4-20250514, gpt-5.4, glm-4.7, codex-auto-review)
- `provider` - Model family, **synthesized at query time** from `model`; no exporter emits it
- `type` - Token type (input, output, cacheRead, cacheCreation) or LOC type (added, removed) or active time type (user, cli)
- `session_id` - Unique session identifier
- `tool_name` - Tool name for tool decision metrics (e.g., Edit, Write, Bash)
- `decision` - Tool decision value (accept, reject)
- `language` - Programming language of edited file (e.g., TypeScript, Python, JavaScript, Markdown)
- `source` - How tool decision was made (config, hook, user_permanent, user_temporary, user_abort, user_reject)
- `device` - Custom device name (set via `OTEL_RESOURCE_ATTRIBUTES="device=my-macbook"`)

## Development

### Local Setup

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Local Observability Stack

The project includes a Docker Compose setup for local development with real Claude Code telemetry:

```bash
docker-compose up -d
# Access Grafana at http://localhost:3000
```

This starts:
- **Grafana** (port 3000) - With the plugin pre-installed
- **Prometheus** (port 9090) - With remote write receiver enabled
- **OTEL Collector** (ports 4317/4318) - Converts delta metrics to cumulative

### Environment Variables (for Claude Code)

Configure Claude Code to send telemetry (metrics only, no logs):

**Local Development Stack:**

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_METRIC_EXPORT_INTERVAL=10000
# Note: OTEL_LOGS_EXPORTER is intentionally not set (no logs)
```

**Grafana Cloud:**

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway-prod-<region>.grafana.net/otlp"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <base64-encoded-instance:token>"
# IMPORTANT: Use cumulative temporality for Grafana Cloud compatibility
export OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative
# Note: OTEL_LOGS_EXPORTER is intentionally not set (no logs)
```

### Claude Code Telemetry Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | Enable telemetry (required) | `1` |
| `OTEL_METRICS_EXPORTER` | Metrics exporter type | `otlp`, `prometheus`, `console` |
| `OTEL_LOGS_EXPORTER` | Logs exporter (omit for metrics-only) | `otlp`, `console` |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | OTLP protocol | `grpc`, `http/json`, `http/protobuf` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Collector endpoint | `http://localhost:4318` |
| `OTEL_EXPORTER_OTLP_HEADERS` | Auth headers | `Authorization=Bearer token` |
| `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` | Metrics temporality (required for Grafana Cloud) | `cumulative` |
| `OTEL_METRIC_EXPORT_INTERVAL` | Export interval (ms) | `10000` (default: 60000) |

**Cardinality Control:**

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_METRICS_INCLUDE_SESSION_ID` | `true` | Include session_id in metrics |
| `OTEL_METRICS_INCLUDE_ACCOUNT_UUID` | `true` | Include user_account_uuid in metrics |

**Multi-Team Support:**

```bash
export OTEL_RESOURCE_ATTRIBUTES="department=engineering,team.id=platform"
```

For full documentation, see: https://code.claude.com/docs/en/monitoring-usage

### OTEL Collector Configuration

The collector config (`otel-collector-config.yaml`) includes:
- OTLP receiver on ports 4317 (gRPC) and 4318 (HTTP)
- `deltatocumulative` processor to convert Claude Code's delta temporality metrics
- Prometheus remote write exporter

## Configuration Notes

### Required Data Sources

- **Prometheus** (or Mimir) - For metrics queries

### Grafana Cloud Setup

The app works with Grafana Cloud which provides:
- Pre-configured Prometheus (Mimir) data source
- OTLP ingestion endpoint for Claude Code telemetry
- Free tier sufficient for most team usage tracking

### Self-Hosted Setup

For self-hosted Grafana:
1. Deploy OTEL Collector with `deltatocumulative` processor
2. Configure Prometheus with remote write receiver
3. Install this plugin in Grafana
4. Configure Claude Code to send telemetry to OTEL Collector

## Contributing

When adding new features:

1. Add new metrics to `src/constants.ts`
2. Define queries in `src/scenes/queries.ts`
3. Create or update scene in `src/scenes/pages/`
4. Update this AGENTS.md with implementation details
