# Plugin Enhancement Design — Claude Stats Grafana App

## Overview

Enhance the Claude Stats Grafana plugin with visual polish, new analytics views, and metadata updates. The changes fall into five areas: metadata/global changes, a new Sessions tab, lines-of-code-per-language views, tool decision source expansion, and chart smoothing.

## 1. Metadata & Global Changes

### Author Rename

Change the `author` field in `plugin.json` from "Timur Olzhabayev" to "xkeanu". No changes to plugin ID (`timurdigital-claudestats-app`), GitHub links, or any other metadata.

### Auto-Refresh Default

Enable auto-refresh by default with a 1-minute interval on the `SceneAppPage` via Grafana Scenes' `SceneTimePicker` refresh configuration. Users can still disable or change the interval.

### Chart Smoothing (Mixed Strategy)

Apply `lineInterpolation: 'smooth'` (cubic spline) to all continuous trend timeseries panels:
- Cost over time (Overview, Costs)
- Token usage over time (Overview, Tokens)
- Active time over time (Overview, Productivity)
- Language usage over time (Languages)
- Environment/version trends over time (Environment)
- Session trends over time (Sessions — new)
- Tool decision source over time (Tools)
- LOC over time (Productivity, Languages)

Keep `GraphDrawStyle.Bars` for discrete event charts:
- Commits over time (Productivity)
- Pull requests over time (Productivity)

No changes to piecharts, stat panels, bar gauges, or tables.

## 2. New Sessions Tab

A new `SessionsScene` page, positioned as the 8th tab after Productivity.

### Layout

**Row 1 — Stat panels (height: STAT, 4 panels at 25% each):**
- **Total Sessions** — existing `totalSessions` query
- **Avg Tokens/Session** — derived: `increase(token_usage_tokens_total{...}[$__range]) / increase(session_count_total{...}[$__range])`
- **Avg Duration/Session** — derived: `increase(active_time_seconds_total{...}[$__range]) / increase(session_count_total{...}[$__range])`, formatted as duration
- **Avg Cost/Session** — derived: `increase(cost_usage_USD_total{...}[$__range]) / increase(session_count_total{...}[$__range])`, formatted as USD

**Row 2 — Trends (height: LARGE):**
- **Sessions Over Time** (60%) — smooth stacked timeseries, `increase(session_count_total{...}[$__rate_interval])` by device
- **Session Intensity Over Time** (40%) — smooth timeseries, `increase(token_usage_tokens_total{...}[$__rate_interval]) / increase(session_count_total{...}[$__rate_interval])`

**Row 3 — Breakdowns (height: LARGE):**
- **Sessions by Device** (40%) — donut piechart
- **Sessions by Model** (30%) — piechart, `increase(session_count_total{...}[$__range])` by model
- **Active Users Over Time** (30%) — smooth timeseries, `count(count by (user_email) (increase(session_count_total{...}[$__rate_interval]) > 0))`

### New Queries

```
avgTokensPerSession:
  increase(claude_code_token_usage_tokens_total{user_email=~"$member", ...ENV_FILTERS}[$__range])
  /
  increase(claude_code_session_count_total{user_email=~"$member", ...ENV_FILTERS}[$__range])

avgActiveTimePerSession:
  increase(claude_code_active_time_seconds_total{user_email=~"$member", ...ENV_FILTERS}[$__range])
  /
  increase(claude_code_session_count_total{user_email=~"$member", ...ENV_FILTERS}[$__range])

avgCostPerSession:
  increase(claude_code_cost_usage_USD_total{user_email=~"$member", ...ENV_FILTERS}[$__range])
  /
  increase(claude_code_session_count_total{user_email=~"$member", ...ENV_FILTERS}[$__range])

sessionsOverTime:
  sum by (device) (increase(claude_code_session_count_total{user_email=~"$member", ...ENV_FILTERS}[$__rate_interval]))

sessionIntensityOverTime:
  sum(increase(claude_code_token_usage_tokens_total{user_email=~"$member", ...ENV_FILTERS}[$__rate_interval]))
  /
  sum(increase(claude_code_session_count_total{user_email=~"$member", ...ENV_FILTERS}[$__rate_interval]))

sessionsByModel:
  sum by (model) (increase(claude_code_session_count_total{user_email=~"$member", model=~"$model", ...ENV_FILTERS}[$__range]))
```

### Registration

- Add `ROUTES.Sessions = 'sessions'` to `constants.ts`
- Register the tab in `SceneAppPage.tsx` after Productivity
- Add navigation entry in `module.ts`

## 3. Lines of Code per Language

### Languages Page (Detailed View)

Add 2 new rows after the existing acceptance rate row, before the device table:

**New Row — LOC by Language (height: LARGE):**
- **Lines of Code by Language** (donut piechart, 40%) — total LOC grouped by `language` label
- **Lines Added vs Removed by Language** (stacked horizontal bar gauge, 60%) — showing added/removed breakdown per language

**New Row — LOC Trends (height: LARGE):**
- **Lines of Code by Language Over Time** (smooth stacked timeseries, full width) — LOC trends per language

### Productivity Page (Summary View)

Modify existing Row 2 layout:
- **Lines Added vs Removed** donut — shrink from 35% to 25%
- **Lines of Code Over Time** — shrink from 65% to 45%
- **Top Languages by LOC** (new piechart, 30%) — summary of language distribution

### New Queries

```
linesOfCodeByLanguage:
  sum by (language) (increase(claude_code_lines_of_code_count_total{user_email=~"$member", language!="", ...ENV_FILTERS}[$__range]))

linesOfCodeByLanguageAndType:
  sum by (language, type) (increase(claude_code_lines_of_code_count_total{user_email=~"$member", language!="", ...ENV_FILTERS}[$__range]))

linesOfCodeByLanguageOverTime:
  sum by (language) (increase(claude_code_lines_of_code_count_total{user_email=~"$member", language!="", ...ENV_FILTERS}[$__rate_interval]))
```

Note: Filter `language!=""` to exclude any LOC metric data points that lack a language label, ensuring only language-attributed edits are counted.

## 4. Tool Decision Source Expansion

### Polish Existing (Tools Page Row 3)

Add value mappings to the source piechart and timeline for human-readable labels:

| Raw value | Display label |
|-----------|--------------|
| `config` | Auto (Config) |
| `hook` | Auto (Hook) |
| `user_permanent` | User (Always) |
| `user_temporary` | User (Once) |
| `user_abort` | User (Abort) |
| `user_reject` | User (Reject) |

### Restructure Row 4

Replace current Row 4 (full-width language piechart) with:
- **Source Breakdown per Tool** (stacked horizontal bar gauge, 60%) — for each tool_name, show distribution of source values
- **Tool Decisions by Language** (piechart, 40%) — existing chart, moved and downsized

### New Query

```
toolDecisionsByToolAndSource:
  sum by (tool_name, source) (increase(claude_code_code_edit_tool_decision_total{user_email=~"$member", ...ENV_FILTERS}[$__range]))
```

## 5. Files Touched

| Change | Files |
|--------|-------|
| Author → "xkeanu" | `plugin.json` |
| Auto-refresh default (1m) | `src/components/scenes/SceneAppPage.tsx` |
| Smooth line interpolation | All 8 scene page files in `src/scenes/pages/` |
| New Sessions tab | `src/scenes/pages/SessionsScene.ts` (new), `src/constants.ts`, `src/scenes/queries.ts`, `src/components/scenes/SceneAppPage.tsx`, `src/module.ts` |
| LOC per language (Languages) | `src/scenes/pages/LanguagesScene.ts`, `src/scenes/queries.ts` |
| LOC summary (Productivity) | `src/scenes/pages/ProductivityScene.ts`, `src/scenes/queries.ts` |
| Tool source expansion | `src/scenes/pages/ToolsScene.ts`, `src/scenes/queries.ts` |
| Documentation | `AGENTS.md` |

## Out of Scope

- No plugin ID change
- No Loki/log event integration (would require a Loki data source)
- No `organization_id` grouping (niche multi-org use case)
- No cache efficiency views (can be added later)
- No new filter variables
- No changes to the Configuration page
