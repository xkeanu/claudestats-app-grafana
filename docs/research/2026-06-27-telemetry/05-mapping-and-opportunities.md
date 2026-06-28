# Telemetry Mapping and Opportunities — 2026-06-27

Analysis of what the Claude Stats Grafana plugin already visualizes, what data exists but is not exposed, and concrete opportunities for new panels and scenes.

---

## 1. Current Mapping Table

Every metric the plugin emits queries for, the scene(s) that consume it, and the label dimensions used for grouping or filtering.

| Metric | Scene(s) | Label dimensions in use |
|--------|----------|-------------------------|
| `claude_code_cost_usage_USD_total` | Overview, Costs, Environment | `model`, `device`, `terminal_type`, `os_type`, `host_arch`, `service_version`, `user_email` |
| `claude_code_token_usage_tokens_total` | Overview, Tokens, Sessions | `type` (input/output/cacheRead/cacheCreation), `model`, `device`, `user_email` |
| `claude_code_session_count_total` | Overview, Sessions | `device`, `model`, `terminal_type`, `user_email` |
| `claude_code_active_time_seconds_total` | Overview (over-time chart), Productivity, Sessions | `type` (user/cli) for over-time only; `device`; `user_email` |
| `claude_code_lines_of_code_count_total` | Productivity | `type` (added/removed), `device`, `user_email` |
| `claude_code_commit_count_total` | Productivity | `device`, `user_email` |
| `claude_code_pull_request_count_total` | Productivity | `device`, `user_email` |
| `claude_code_code_edit_tool_decision_total` | Tools, Languages | `decision`, `tool_name`, `source`, `language`, `device`, `user_email` |
| `codex_turn_token_usage_sum` | Overview (combined), Tokens (combined), Sessions (combined), Codex | `token_type`, `model`, `originator`, `session_source`, `os` |
| `codex_tool_call_total` | Tools (combined bargauge), Codex | `tool`, `success`, `model`, `originator`, `session_source`, `os` |
| `codex_guardian_review_total` | Tools (combined accept/reject), Codex (approval rate stat) | `decision` (approved/denied) |
| `codex_thread_started_total` | Overview, Sessions (combined total) | `model`, `originator`, `session_source`, `os` |
| `codex_conversation_turn_count_total` | Codex (stat) | `model`, `originator`, `session_source`, `os` |
| `codex_turn_e2e_duration_ms_milliseconds_sum/count` | Codex (avg turn duration stat) | `model`, `originator`, `session_source`, `os` |
| `codex_api_request_total` | Codex, Environment (Codex rows) | `originator`, `session_source`, `os`, `app_version` |
| `codex_sse_event_total` | Codex | `originator`, `session_source`, `os` |

**Notes:**
- `user_email` is always present as a _filter_ variable (`$member`) across every scene. It is never used as a _grouping dimension_ (no per-member breakdown panels exist).
- Environment scene uses `cost_usage` as a proxy for counting usage by OS/arch/terminal/version — not dedicated counter metrics.

---

## 2. Unused-Data Gaps

### Queries defined in `src/scenes/queries.ts` but rendered in zero scenes

| Query key | PromQL grouping | Why it matters |
|-----------|-----------------|----------------|
| `activeTimeByType` (line 192) | `by (type)` → user vs cli | Distribution pie/stat of keyboard vs AI execution time; the over-time version is shown in Overview but the aggregate distribution never is |
| `sessionsByTerminalType` (line 215) | `by (terminal_type)` | Session count split by IDE vs terminal; the analogous cost split exists in Environment but sessions don't |
| `membersByOsType` (line 218) | `count by (os_type)` of distinct users | Number of unique team members per OS; useful for "how many people are on Windows?" |

### Label dimensions available but never visualized as breakdowns

| Label | Metric(s) it appears on | Gap |
|-------|--------------------------|-----|
| `user_email` | all Claude Code metrics | No per-member breakdown panel anywhere (cost, tokens, sessions, LOC by user_email). The `$member` variable filters to one user but never groups for comparison. |
| `os_version` (LABELS.OS_VERSION, constants.ts:73) | Claude Code resource attrs | Defined in LABELS, never used in any query or panel |
| `source` (decision source) | `tool_decision` | Used in ToolsScene only; absent from Languages scene even though the same metric backs both |
| `success` (LABELS.CODEX_SUCCESS, constants.ts:88) | `codex_tool_call_total` | Only used in the aggregated `codexToolSuccessRate` stat — no breakdown by tool name showing which tools fail |
| `session_id` | all Claude Code metrics | High cardinality — intentionally not grouped; legitimate gap |
| `host_arch` | `cost_usage` (Environment) | Only used in the "Claude Architecture" pie in Environment; not cross-tabbed with anything else |

### Missing cross-tool queries

- No Codex thread_started trend over time (only total). A timeseries of Codex sessions vs Claude sessions in one panel would close this.
- No Codex tokens by model breakdown (the combined `tokensByModel` query mixes both tools but a Codex-only model split doesn't exist).

---

## 3. New Panel / Scene Opportunities

Each row is a concrete, repo-grounded idea.

| # | Idea | Metric(s) | Rough PromQL sketch | Target scene file | Effort |
|---|------|-----------|---------------------|-------------------|--------|
| 1 | **Per-member cost leaderboard** | `cost_usage` | `sum by (user_email) (increase(claude_code_cost_usage_USD_total{...}[$__range]))` | `CostsScene.ts` — new table/bargauge row | S |
| 2 | **Per-member tokens table** | `token_usage` | `sum by (user_email) (increase(claude_code_token_usage_tokens_total{...}[$__range]))` | `TokensScene.ts` — new table row | S |
| 3 | **Cache hit ratio stat** | `token_usage` | `sum(increase(...{type="cacheRead"}[$__range])) / clamp_min(sum(increase(...[$__range])), 1) * 100` | `TokensScene.ts` — new stat in Row 1 | S |
| 4 | **Cost per output token** | `cost_usage`, `token_usage` | `sum(increase(cost_usage{...}[$__range])) / clamp_min(sum(increase(token_usage{type="output",...}[$__range])), 1)` | `TokensScene.ts` or `CostsScene.ts` stat | S |
| 5 | **Active time breakdown pie** | `active_time` | `sum by (type) (increase(claude_code_active_time_seconds_total{...}[$__range]))` — `QUERIES.activeTimeByType` already exists | `ProductivityScene.ts` — add a pie/stat in Row 1 | XS (query exists) |
| 6 | **Sessions by terminal type** | `session_count` | `QUERIES.sessionsByTerminalType` already exists | `SessionsScene.ts` — add piechart or `EnvironmentScene.ts` | XS (query exists) |
| 7 | **Tool acceptance rate trend** | `tool_decision` | `sum(increase({decision="accept",...}[$__rate_interval])) / clamp_min(sum(increase({...}[$__rate_interval])), 1) * 100` | `ToolsScene.ts` — timeseries replacing/augmenting the static stat | S |
| 8 | **Codex tool success breakdown by tool** | `codex_tool_call_total` | `sum by (tool) (increase(codex_tool_call_total{success="true",...}[$__range])) / clamp_min(sum by (tool) (increase(codex_tool_call_total{...}[$__range])), 1) * 100` | `CodexScene.ts` — new bargauge row | S |
| 9 | **LOC per session** | `lines_of_code`, `session_count` | `sum(increase(loc{...}[$__range])) / clamp_min(round(sum(increase(session_count{...}[$__range]))), 1)` | `ProductivityScene.ts` stat or `SessionsScene.ts` | S |
| 10 | **Member OS breakdown (count of users)** | `cost_usage` | `QUERIES.membersByOsType` already exists | `EnvironmentScene.ts` — stat alongside pie, or table | XS (query exists) |
| 11 | **Codex vs Claude sessions trend** | `session_count`, `thread_started` | Two series: `round(sum(increase(session_count{...}[$__rate_interval])))` and `round(sum(increase(thread_started{...}[$__rate_interval])))` | `SessionsScene.ts` — new combined timeseries | S |
| 12 | **Tool decision source trend** | `tool_decision` | `QUERIES.toolDecisionsBySourceOverTime` already exists but not rendered | Already in `ToolsScene.ts` Row 3 — **it is already rendered** (verify `toolDecisionsBySourceOverTimeQuery` at line 84–93) | — |
| 13 | **Per-member sessions leaderboard** | `session_count` | `round(sum by (user_email) (increase(claude_code_session_count_total{...}[$__range])))` | `SessionsScene.ts` — new table row | S |
| 14 | **Cache creation vs cache read ratio over time** | `token_usage` | `sum by (type) (rate(...{type=~"cacheRead\|cacheCreation",...}[$__rate_interval]))` | `TokensScene.ts` — additional timeseries | S |

Highest ROI items with zero query work (queries already exist): #5, #6, #10.

---

## 4. CodexScene Status

**File:** `src/scenes/pages/CodexScene.ts` (untracked in git, 186 lines)
**Status: Fully implemented — not a stub.**

The scene is complete and already wired into `SceneAppPage.tsx` (imported at line 14, registered as a tab at lines 63–68). It implements three layout rows:

- **Row 1 (6 stats):** Codex Total Tokens, Codex API Requests, Avg Codex Turn Duration (ms), Guardian Approval Rate (%), Tool Success Rate (%), Conversation Turns
- **Row 2:** "Codex Tokens by Token Type" stacked timeseries + "Codex Tool Calls by Tool" horizontal bargauge
- **Row 3:** "Codex API Requests and SSE Events" combined timeseries

Queries used: `codexTotalTokens`, `codexApiRequests`, `codexTurnDuration`, `codexApprovalRate`, `codexToolSuccessRate`, `codexTurnCount`, `codexTokensByType`, `codexToolCallsByTool`, `codexApiRequestsOverTime`, `codexSseEventsOverTime` — all from `queries.ts`.

**What's missing from CodexScene that would be natural additions:**
- No Codex thread_started trend (sessions over time)
- No per-model token breakdown (Codex-only)
- No tool success rate broken down by tool name (opportunity #8 above)

---

## 5. Conventions a New Scene Must Follow

Based on reading all nine existing scene files:

1. **Factory function signature** — `export function getXxxScene(timeRange: SceneTimeRange, variables: SceneVariableSet): EmbeddedScene` in `src/scenes/pages/XxxScene.ts`. No React, no state.

2. **One `SceneQueryRunner` per panel** — each runner holds one (occasionally two) queries. Datasource always `{ type: 'prometheus', uid: '${prometheus_ds}' }`. `legendFormat` uses `{{label_name}}` interpolation.

3. **Layout structure** — `EmbeddedScene` → `SceneFlexLayout({ direction: 'column' })` → rows of `SceneFlexLayout({ direction: 'row', height: PANEL_HEIGHTS.X })` → `SceneFlexItem({ width: 'N%', body: PanelBuilders... })`.

4. **Standard controls block** — every scene copies the same four controls: `VariableValueSelectors`, `SceneControlsSpacer`, `SceneTimePicker({ isOnCanvas: true })`, `SceneRefreshPicker({ refresh: '1m', intervals: [...] })`.

5. **No inline PromQL** — all expressions live in `src/scenes/queries.ts` as named constants in the `QUERIES` object, with a JSDoc comment. Scene files only reference `QUERIES.queryName`.

6. **Metric and label names from constants** — `METRICS.CLAUDE_CODE.X`, `METRICS.CODEX.X`, `LABELS.X` in `src/constants.ts`. Never hard-coded strings in queries.

7. **Registration** — add a `ROUTES.Xxx` entry in `src/constants.ts`, import the function in `src/components/scenes/SceneAppPage.tsx`, and add a `new SceneAppPage({...})` tab entry.

8. **Variables are shared** — `getSharedVariables()` is called once at app startup and passed to every scene. Scenes do not create their own variables. Codex-specific filters (`codex_originator`, `codex_session_source`, `codex_os`) are already in the shared set.

9. **Height constants** — use `PANEL_HEIGHTS.STAT` (100), `PANEL_HEIGHTS.MEDIUM` (200), `PANEL_HEIGHTS.LARGE` (300), `PANEL_HEIGHTS.TABLE` (250).

---

## Summary of Top Opportunities and CodexScene Verdict

**Top opportunities (impact vs effort):**

Three queries already written and wired but never rendered — add a panel each with ~15 lines: `activeTimeByType` (user vs CLI active time distribution, ProductivityScene), `sessionsByTerminalType` (SessionsScene piechart), `membersByOsType` (EnvironmentScene stat). These are the easiest wins.

The single biggest analytical gap is the **absence of per-member breakdowns**: every metric has `user_email` as a label but no scene groups by it to produce a team leaderboard. Adding cost, tokens, and sessions tables grouped by `user_email` to CostsScene, TokensScene, and SessionsScene respectively would give team leads the at-a-glance usage view they almost certainly want.

Derived efficiency metrics are cheap to add and high-signal: **cache hit ratio** (`cacheRead / total tokens`) as a stat in TokensScene, **cost per output token** in CostsScene, and **LOC per session** in ProductivityScene all use existing queries with simple arithmetic.

For the Codex scene, the most natural addition is a **tool success rate bargauge broken down by tool name** (`codex_tool_call_total{success="true"} / all`) — it closes the gap between the existing aggregate stat and what's useful operationally.

**CodexScene verdict:** Fully implemented, fully registered, not a stub. It is only untracked in git because it was added in the current working branch without being committed yet. The scene covers the key Codex metrics (tokens, API volume, turn duration, guardian approval, tool success rate) and is ready for use.
