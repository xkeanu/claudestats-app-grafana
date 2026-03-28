# Time-Range-Aware Stat Panels

## Problem

Stat panels (Total Cost, Total Tokens, Sessions, Active Users) always show all-time cumulative values regardless of the Grafana time picker selection. Charts respect the time picker via `increase()` / `rate()`, creating a confusing disconnect.

**Root cause:** Stat queries use bare counter expressions (`sum(metric{...})`) with `instant: true`, which returns the current cumulative counter value and ignores the time range.

## Solution

Convert all stat/summary queries from bare counters to `increase(metric{...}[$__range])` and remove `instant: true`. The `$__range` variable automatically matches the selected time picker window.

### Query Changes

#### Pattern 1: Simple sums (cost, tokens, LOC, commits, PRs, active time)
```
# Before
sum(metric{filters...})  [instant: true]

# After
sum(increase(metric{filters...}[$__range]))
```

#### Pattern 2: Count unique values (sessions, active users, languages)
```
# Before
count(count by (label) (metric{filters...}))  [instant: true]

# After
count(count by (label) (increase(metric{filters...}[$__range]) > 0))
```

#### Pattern 3: Ratios (acceptance rate)
```
# Before
sum(metric{decision="accept"}) / sum(metric{}) * 100  [instant: true]

# After
sum(increase(metric{decision="accept"}[$__range])) / sum(increase(metric{}[$__range])) * 100
```

#### Pattern 4: Breakdown by label (pie charts, bar gauges)
```
# Before
sum by (label) (metric{filters...})  [instant: true]

# After
sum by (label) (increase(metric{filters...}[$__range]))
```

### Queries to Update in `queries.ts`

| Query | Current | Pattern |
|-------|---------|---------|
| `totalCost` | `sum(cost{...})` | 1 |
| `costByModel` | `sum by (model) (cost{...})` | 4 |
| `costByMember` | `sum by (email) (cost{...})` | 4 |
| `totalTokens` | `sum(tokens{...})` | 1 |
| `tokensByType` | `sum by (type) (tokens{...})` | 4 |
| `tokensByModel` | `sum by (model) (tokens{...})` | 4 |
| `tokensByMember` | `sum by (email) (tokens{...})` | 4 |
| `totalSessions` | `count(count by (sid) (...))` | 2 |
| `sessionsByMember` | `count by (email) (count by (sid, email) (...))` | 2 |
| `activeUsers` | `count(count by (email) (...))` | 2 |
| `totalLinesOfCode` | `sum(loc{...})` | 1 |
| `linesOfCodeByType` | `sum by (type) (loc{...})` | 4 |
| `linesOfCodeByMember` | `sum by (email) (loc{...})` | 4 |
| `totalCommits` | `sum(commits{...})` | 1 |
| `commitsByMember` | `sum by (email) (commits{...})` | 4 |
| `totalPullRequests` | `sum(prs{...})` | 1 |
| `pullRequestsByMember` | `sum by (email) (prs{...})` | 4 |
| `totalActiveTime` | `sum(time{...})` | 1 |
| `activeTimeByMember` | `sum by (email) (time{...})` | 4 |
| `toolDecisions` | `sum by (decision) (tool{...})` | 4 |
| `toolDecisionsByTool` | `sum by (tool) (tool{...})` | 4 |
| `toolAcceptanceRate` | `sum(accept) / sum(all) * 100` | 3 |
| `toolDecisionsByLanguage` | `sum by (lang) (tool{...})` | 4 |
| `toolDecisionsBySource` | `sum by (source) (tool{...})` | 4 |
| `toolDecisionsByToolAndLanguage` | `sum by (tool, lang) (tool{...})` | 4 |
| `totalLanguages` | `count(count by (lang) (...))` | 2 |
| `languageAcceptanceRate` | ratio by lang | 3 |
| `toolDecisionsByLanguageAndMember` | `sum by (lang, email) (...)` | 4 |
| `activeTimeByType` | `sum by (type) (time{...})` | 4 |
| All environment queries | `sum by (label) (cost{...})` | 4 |
| Session-count environment queries | `count by (...) (count by (...) (...))` | 2 |

### Scene File Changes

Remove `instant: true` from ALL SceneQueryRunner configs that use the updated queries. Affected files:
- `src/scenes/pages/OverviewScene.ts`
- `src/scenes/pages/CostsScene.ts`
- `src/scenes/pages/TokensScene.ts`
- `src/scenes/pages/ToolsScene.ts`
- `src/scenes/pages/ProductivityScene.ts`
- `src/scenes/pages/LanguagesScene.ts`
- `src/scenes/pages/EnvironmentScene.ts`

### Default Time Range

Change `SceneTimeRange` from `now-6h` to `now-7d` in `src/components/scenes/SceneAppPage.tsx`.

### Server: Prometheus Retention

Update Prometheus on Hetzner (162.55.221.167) to retain 90 days:
- Add `--storage.tsdb.retention.time=90d` to Prometheus command in `docker-compose.yaml`

### Panel Grouping: Device instead of Team Member

Replace "by Team Member" panel breakdowns with "by Device" across all scenes. This is more useful for both solo users (multiple devices) and teams (device-level granularity).

**Changes:**
- "Cost by Team Member" pie chart -> "Cost by Device"
- "Tokens by Team Member" table -> "Tokens by Device"
- "Lines of Code by Team Member" -> "Lines of Code by Device"
- "Commits by Team Member" -> "Commits by Device"
- "Active Time by Team Member" -> "Active Time by Device"
- etc.

**Queries affected:** All `*ByMember` queries get replaced with `*ByDevice` equivalents:
```
# Before
sum by (user_email) (increase(metric{...}[$__range]))

# After
sum by (device) (increase(metric{...}[$__range]))
```

**Team support preserved:** The Team Member filter variable stays in the variable bar. Users can still filter to a specific team member - the panels then show that member's device breakdown.

## Verification

1. `npm run build` succeeds
2. Deploy to Hetzner Grafana
3. Select "Last 24 hours" - stat panels should show only today's values
4. Select "Last 7 days" - stat panels should show the week's values
5. Values in stat panels should roughly match the area under the chart curves
