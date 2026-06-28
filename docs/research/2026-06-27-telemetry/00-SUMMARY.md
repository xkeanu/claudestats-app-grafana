# Telemetry Research — Executive Summary

**Date:** 2026-06-27
**Question:** What data do Claude Code, Codex, and other AI coding tools deliver via OpenTelemetry, how is it named, and how could we map it into more/better stats in the Claude Stats Grafana plugin?
**Method:** 6 parallel research agents (web + official docs + community + live-stack inventory + repo analysis). Each wrote its own subreport in this folder; this is the synthesis.

| # | Subreport | Scope |
|---|-----------|-------|
| 01 | [`01-claude-code-telemetry.md`](01-claude-code-telemetry.md) | Claude Code OTEL metrics, events, labels, flags |
| 02 | [`02-codex-telemetry.md`](02-codex-telemetry.md) | OpenAI Codex CLI telemetry (equal depth) |
| 03 | [`03-real-data-inventory.md`](03-real-data-inventory.md) | Live inventory of the local Prometheus |
| 04 | [`04-dashboards-and-community.md`](04-dashboards-and-community.md) | Community dashboards + panel/PromQL idea catalog |
| 05 | [`05-mapping-and-opportunities.md`](05-mapping-and-opportunities.md) | What the repo already maps + gaps/opportunities |
| 06 | [`06-other-tools-telemetry.md`](06-other-tools-telemetry.md) | Gemini CLI, OpenCode, Aider, Cline, Cursor, Copilot… |

---

## TL;DR — the things that matter

> **Where the real data lives:** the plugin's **default** Grafana datasource ("Claude Stats Remote") proxies to the **remote Hetzner Prometheus at `http://162.55.221.167:9090`** — 90-day retention, data live to the minute. The *local* docker Prometheus is the idle, non-default `prometheus-local` (0 AI series). All real-data numbers below are from the remote, confirmed 2026-06-27.

1. **Real data is rich and live.** Remote Prometheus holds **154 AI metrics** (8 `claude_code_*` + **146 `codex_*`**). Over 90 days: **5,148 sessions, $8,399.70 cost, 553K LOC added, 1,448 commits, 436 PRs, 7 users.** Codex telemetry in the wild is *far* richer than its docs (guardian reviews, two-phase memory, feature flags, per-turn latency, hooks).
2. **Most new Claude Code labels are REAL** (confirmed in live data, no new metrics, no infra change): `start_type` (fresh/resume), `query_source` (main/subagent/auxiliary), `effort` (medium/high/xhigh/max), `agent_name` (15 values), `skill_name` (55), `plugin_name`, and `model` on LOC. **Two caveats:** `speed` is **absent** (0 series in 90 days), and `mcp_server_name`/`mcp_tool_name` exist but are always `"custom"` — **no usable MCP attribution.**
3. **The dashboard assumes Claude-only models, but real data has 27 model values** including non-Anthropic: `gpt-5.4/5.5`, `glm-4.7/5.x`, plus `codex-auto-review`. Any Claude-model-hardcoded query/legend will mislead.
4. **Codex CLI emits OTEL natively** (PR #2103, Sept 2025) — and the repo **already integrates it** (CodexScene.ts + `codex_*` queries). Gaps: no cost metric (derive from tokens), no per-user metric label (logs only), no LOC/commit/PR.
5. **Gemini CLI is the strongest next data source** (native OTEL, clean `gemini_cli.*`, plugs into the existing collector); **OpenCode** second. Cursor/Aider/Continue/Roo are OTEL dead-ends.
6. **Best dashboard wins are cheap:** cache-hit ratio, ROI (lines/$), `query_source` & `effort` breakdowns, skill/agent/plugin cost attribution, model-family grouping (Claude vs GPT vs GLM), and a cost-spike alert. Three of our own already-written queries aren't even rendered yet.
7. **Two data-correctness traps confirmed in real data:** (a) `session_count` series are session-scoped and go stale — `sum()` returns ~1; use `last_over_time(...[90d])` (or `sum_over_time`) for true totals. (b) **`decision` label collision:** `claude_code` uses accept/reject, Codex guardian uses approved/denied — same key, different vocab; any query spanning both breaks.

---

## 1. Claude Code — what's available (report 01 + 04)

**Metrics (all 8 confirmed accurate, no new ones in 2026):**
`session.count`, `cost.usage`, `token.usage`, `code_edit_tool.decision`, `lines_of_code.count`, `commit.count`, `pull_request.count`, `active_time.total` → Prometheus names with unit suffixes unchanged.

**NEW labels we should adopt** (on existing metrics — no infra change). **"Live?" column = confirmed against the remote 90-day dataset (report 03):**

| Label | On metric | Live? | Real values seen | Why it matters |
|-------|-----------|:---:|------------------|----------------|
| `start_type` | session.count | ✅ | fresh, resume | Filter UI/non-session starts; session-type breakdown |
| `query_source` | cost, token | ✅ | main, subagent, auxiliary | Splits interactive vs agentic/background spend |
| `effort` | cost, token | ✅ | medium, high, xhigh, max | Cost distribution by reasoning effort |
| `agent_name` | cost, token | ✅ | 15 (Explore, Plan, general-purpose, workflow-subagent, deep-researcher…) | Subagent cost attribution |
| `skill_name` | cost, token | ✅ | 55 (superpowers:*, code-review, deep-research…) | Skill cost attribution |
| `plugin_name` | cost, token | ✅ | superpowers, feature-dev, claude-md-management, third-party | Plugin cost attribution |
| `model` | lines_of_code | ✅ | e.g. claude-opus-4-8 | Per-model LOC (Claude Code v2.1.172+) |
| `speed` | cost, token | ❌ | **none — 0 series in 90 days** | Fast-mode flag not emitted in our data; skip for now |
| `mcp_server_name` / `mcp_tool_name` | cost, token | ⚠️ | always `"custom"` | Schema present but **no granular signal** — not worth a panel until upstream populates it |
| `source` | tool_decision | ✅ | 8 incl. undocumented **`plugin`**, `project` | Decision automation level; more values than docs list |

**Beyond metrics (need a logs/traces backend — Loki/Tempo):**
- **Events (logs):** 20+ types — `user_prompt`, `tool_result`, `api_request` (has `duration_ms`, `cost_usd`, per-request tokens), `compaction`, `api_refusal`, `hook_execution_complete`, `skill_activated`, `mcp_server_connection`, `feedback_survey`. Enables per-request latency, tool failure rates, refusal tracking — but only with Loki/Grafana Cloud Logs.
- **Traces (beta):** `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` → full span hierarchy with `ttft_ms`, subagent nesting (`agent_id`/`parent_agent_id`). Needs Tempo/Jaeger.

---

## 2. Codex CLI — what's available (report 02)

**Verdict: native OTEL = YES** (logs+metrics+traces, PR #2103 merged 2025-09-29). Config lives in `~/.codex/config.toml [otel]`, disabled by default, delta temporality. `codex exec` and `codex mcp-server` emit nothing (upstream gap). Grafana Cloud ships a native Codex integration + 3 prebuilt dashboards.

**Maps cleanly:** `codex_turn_token_usage` (labels model, token_type=input/output/cached/reasoning) ≈ Claude's token metric; `codex_thread_started` ≈ session count. Codex also has *richer* perf metrics than Claude (TTFT, TBT, e2e latency histograms, reasoning tokens, tool-call duration).

**Three gaps vs Claude Code:**
1. **No cost metric** → derive from tokens × pricing (recording rule / external).
2. **No per-user label on metrics** → `user.account_id` lives only in log events; team aggregates work, per-user filtering needs log correlation.
3. **No LOC/commit/PR** → would need separate git instrumentation.

> Note: the repo **already** has a working `CodexScene` and `codex_*` queries (see §4). This research mostly confirms/extends it rather than starting fresh.

**Real data has 146 `codex_*` metrics — WAY beyond the docs (report 03).** Undocumented families worth surfacing, none of which CodexScene touches yet:
- **`codex_guardian_review_*`** — full AI action-gating audit trail: `risk_level` (low/med/high), `outcome` (allow/block), `decision` (approved/denied), `user_authorization`, `guardian_model`, reasoning effort, TTFT + token histograms. A whole "AI safety/approvals" panel set.
- **`codex_memory_phase1/phase2_*`** — two-phase memory consolidation with per-phase timing, token histograms, and status (claimed/skipped_cooldown).
- **`codex_feature_state_total`** — 15 feature flags tracked per session (memories, multi_agent, apps, hooks, plugins…) → feature-adoption cohort analysis.
- **`codex_turn_*`** — per-turn TTFT/TTFM/e2e latency + token + tool-call distributions (richer perf than Claude).
- **`codex_hooks_run_*`** — 5 hook types × source × status.
- **`codex_tool_call_*`** — 30 tools with `sandbox`/`sandbox_policy` (seatbelt/workspace-write) + success, incl. `multi_agent_v1spawn_agent`, `mcp__serena*`, `mcp__codex_apps__*`.

---

## 3. Other tools — who's worth adding next (report 06)

| Tool | Native OTEL? | Ingest difficulty | Verdict |
|------|:---:|:---:|---------|
| **Gemini CLI** | ✅ `gemini_cli.*` | 2/5 | **#1 next** — clean namespace, token-type breakdown, sessions, latency; plugs into existing collector; Google ships dashboards. No cost metric (derive). |
| **OpenCode** | ⚠️ via DEVtheOPS plugin (native upstream WIP) | 2/5 | **#2** — plugin mirrors Claude's signal set (tokens, cost, model, sessions, LOC, commits, decisions); existing dashboards need only label changes. |
| **GitHub Copilot** | REST API (org/team aggregates) | 2/5 | **#3** — acceptance rate, active users, accepted LOC, language/IDE breakdowns. Not per-session. Good adoption-KPI source. |
| Cline/Roo | undocumented / shut down | — | Defer / skip (Roo shut down May 2026). |
| Cursor | Enterprise-only proprietary | — | Skip (no public OTEL). |
| Aider | PostHog only | — | Skip (no OTEL). |
| Continue.dev | telemetry removed (acquired by Cursor) | — | Skip. |

---

## 4. What the repo already does + where the gaps are (report 05)

**Already mapped:** all 8 Claude metrics across Overview/Costs/Tokens/Tools/Productivity/Sessions/Languages/Environment, **plus a fully-implemented (untracked) `CodexScene`** with `codex_turn_token_usage`, `codex_tool_call`, `codex_guardian_review`, `codex_thread_started`, `codex_conversation_turn_count`, `codex_turn_e2e_duration`, `codex_api_request`, `codex_sse_event`. CodexScene is real, registered as a tab, and only untracked because it's uncommitted on this branch.

**Quick wins — queries already written but rendered nowhere:**
- `activeTimeByType` (user vs CLI distribution) → ProductivityScene pie
- `sessionsByTerminalType` → SessionsScene piechart
- `membersByOsType` → EnvironmentScene stat

**Biggest analytical gap:** every Claude metric carries `user_email` but **no scene groups by it** — `$member` only filters to one user, never produces a team leaderboard. Add per-member cost/tokens/sessions tables.

**Cheap derived metrics (existing queries + arithmetic):** cache-hit ratio (TokensScene), cost-per-output-token (Costs/Tokens), LOC-per-session (Productivity).

**New-label opportunities (need §1 labels added to constants/queries):** `query_source` breakdown, `effort` cost bars, `speed=fast` fraction, MCP-server/skill cost attribution, `start_type` session fix.

---

## 5. Must-fix pitfalls in our pipeline (report 04 §5)

- **P1 Delta temporality** — must use `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` (already in AGENTS.md; keep setup-guide emphatic — #1 cause of "no data").
- **P8 `agents_view`** — likely *not* filtered in our session-count queries; add `{start_type!="agents_view"}`.
- **P2 LOC delta gauge** — audit `increase()` vs `sum_over_time()` on LOC panels.
- **P3 `session_id` cardinality** — recommend `OTEL_METRICS_INCLUDE_SESSION_ID=false` for large teams in the setup guide.
- **P6 `resource_to_telemetry_conversion`** — required so `terminal.type` (a resource attr) shows as a label.

---

## 6. Recommended next actions (ordered)

**Tier 0 — Correctness fixes (do first; confirmed against real data):**
- **Session totals are wrong-by-design** if using `sum()` — series are session-scoped and go stale, so `sum(session_count)` ≈ 1. Use `last_over_time(...[range])` / `sum_over_time`. Audit every session panel.
- **Model legends/filters assume Claude IDs** but real data has 27 models incl. `gpt-5.4/5.5`, `glm-*`, `codex-auto-review`. Add a model-family grouping (Claude/GPT/GLM/other) instead of hardcoding.
- **`decision` collision:** scope every tool-decision query to its tool — never aggregate `claude_code_*{decision=...}` and `codex_guardian_review_*{decision=...}` together (accept/reject vs approved/denied).

**Tier 1 — Free wins, no schema work (hours):** render the 3 already-written-but-unused queries (`activeTimeByType`, `sessionsByTerminalType`, `membersByOsType`); add cache-hit-ratio + cost-per-output-token + LOC-per-session stats.

**Tier 2 — New labels (small; constants + query edits, all confirmed live):** add `query_source`, `effort`, `agent_name`, `skill_name`, `plugin_name` to constants and build cost-attribution panels; add `start_type` session breakdown; per-member leaderboards (cost/tokens/sessions by `user_email`). **Skip `speed` (absent) and MCP name labels (always "custom").**

**Tier 3 — Surface the rich Codex telemetry already flowing:** new CodexScene rows for guardian reviews (risk/outcome/approval), feature-flag adoption, per-turn latency, hook activity, sandbox-policy breakdown. For Codex cost, add a token×pricing recording rule.

**Tier 4 — New data sources:** Gemini CLI (native OTEL, mirrors the Codex integration pattern), then OpenCode; consider a Copilot REST→Prometheus exporter for mixed teams.

**Tier 5 — Backends:** wire Loki for event-based panels (tool failure rates, refusals, per-request latency) and optionally Tempo for the traces beta.

---

*All claims are sourced inline in the individual subreports. Label/metric claims have been validated against the live remote Prometheus (`162.55.221.167:9090`, 90-day window) in report 03; doc-only claims not yet seen in live data are flagged there.*
