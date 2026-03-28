# Time-Range-Aware Stats & Device Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all stat/pie/bar panels respect the Grafana time picker, replace "by Team Member" breakdowns with "by Device", change default time range to 7 days, and set Prometheus retention to 90 days.

**Architecture:** All stat/summary queries currently use bare counter expressions with `instant: true` which always return all-time cumulative values. We wrap them in `increase(metric[$__range])` so they return the delta within the selected time window. Panels grouped "by member" switch to "by device" for better solo/multi-device usability while keeping the team member filter variable.

**Tech Stack:** PromQL, Grafana Scenes (@grafana/scenes), TypeScript, Docker Compose (Prometheus config)

---

### Task 1: Update all queries in `queries.ts` to be time-range-aware

**Files:**
- Modify: `src/scenes/queries.ts`

- [ ] **Step 1: Update simple sum queries (Pattern 1)**

Wrap bare `sum(metric{...})` queries in `increase(metric{...}[$__range])`. These queries are: `totalCost`, `totalTokens`, `totalLinesOfCode`, `totalCommits`, `totalPullRequests`, `totalActiveTime`.

```typescript
// COST QUERIES
/** Total cost across all users/models */
totalCost: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

// TOKEN QUERIES
/** Total tokens (all types) */
totalTokens: `sum(increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

// PRODUCTIVITY QUERIES
/** Total lines of code (added + removed) */
totalLinesOfCode: `sum(increase(${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

/** Total commits */
totalCommits: `sum(increase(${METRICS.COMMITS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

/** Total pull requests */
totalPullRequests: `sum(increase(${METRICS.PULL_REQUESTS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

// ACTIVITY QUERIES
/** Total active time in seconds */
totalActiveTime: `sum(increase(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,
```

- [ ] **Step 2: Update count-unique queries (Pattern 2)**

For `totalSessions`, `activeUsers`, `totalLanguages` — wrap inner metric in `increase(...[$__range]) > 0` to only count labels active within the window.

```typescript
// SESSION QUERIES
/** Total sessions - count unique session_id labels active in range */
totalSessions: `count(count by (${LABELS.SESSION_ID}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

/** Active users - count unique user_email labels active in range */
activeUsers: `count(count by (${LABELS.USER_EMAIL}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

// LANGUAGE QUERIES
/** Total unique languages active in range */
totalLanguages: `count(count by (${LABELS.LANGUAGE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]) > 0))`,
```

- [ ] **Step 3: Update ratio queries (Pattern 3)**

Wrap both numerator and denominator in `increase(..[$__range])`:

```typescript
/** Tool acceptance rate within time range */
toolAcceptanceRate: `sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.DECISION}="accept", ${ENV_FILTERS}}[$__range])) / sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])) * 100`,

/** Language acceptance rate within time range */
languageAcceptanceRate: `sum by (${LABELS.LANGUAGE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DECISION}="accept", ${LABELS.LANGUAGE}!=""}[$__range])) / sum by (${LABELS.LANGUAGE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range])) * 100`,
```

- [ ] **Step 4: Update breakdown-by-label queries (Pattern 4)**

Wrap all `sum by (label) (metric{...})` queries in `increase(...[$__range])`:

```typescript
// COST
costByModel: `sum by (${LABELS.MODEL}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

// TOKEN
tokensByType: `sum by (${LABELS.TOKEN_TYPE}) (increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

tokensByModel: `sum by (${LABELS.MODEL}) (increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

// PRODUCTIVITY
linesOfCodeByType: `sum by (${LABELS.LOC_TYPE}) (increase(${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

// TOOL
toolDecisions: `sum by (${LABELS.DECISION}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

toolDecisionsByTool: `sum by (${LABELS.TOOL}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

toolDecisionsByLanguage: `sum by (${LABELS.LANGUAGE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

toolDecisionsBySource: `sum by (${LABELS.DECISION_SOURCE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

toolDecisionsByToolAndLanguage: `sum by (${LABELS.TOOL}, ${LABELS.LANGUAGE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

// ACTIVE TIME
activeTimeByType: `sum by (${LABELS.ACTIVE_TIME_TYPE}) (increase(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

// ENVIRONMENT — all the `sum by (label) (cost{...})` queries
usageByOsType: `sum by (${LABELS.OS_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

usageByHostArch: `sum by (${LABELS.HOST_ARCH}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

usageByTerminalType: `sum by (${LABELS.TERMINAL_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

usageByServiceVersion: `sum by (${LABELS.SERVICE_VERSION}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

costByTerminalType: `sum by (${LABELS.TERMINAL_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

costByOsType: `sum by (${LABELS.OS_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

usageByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range]))`,

costByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range]))`,
```

- [ ] **Step 5: Update session-count environment queries (Pattern 2)**

```typescript
sessionsByTerminalType: `count by (${LABELS.TERMINAL_TYPE}) (count by (${LABELS.SESSION_ID}, ${LABELS.TERMINAL_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

membersByOsType: `count by (${LABELS.OS_TYPE}) (count by (${LABELS.USER_EMAIL}, ${LABELS.OS_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,
```

- [ ] **Step 6: Replace `*ByMember` queries with `*ByDevice` equivalents**

Replace these queries (rename + change grouping label):

```typescript
// COST — rename costByMember -> costByDevice
costByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.COST_USAGE}{${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

// TOKEN — rename tokensByMember -> tokensByDevice
tokensByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.TOKEN_USAGE}{${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

// SESSION — rename sessionsByMember -> sessionsByDevice
sessionsByDevice: `count by (${LABELS.DEVICE}) (count by (${LABELS.SESSION_ID}, ${LABELS.DEVICE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

// PRODUCTIVITY — rename linesOfCodeByMember -> linesOfCodeByDevice
linesOfCodeByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.LINES_OF_CODE}{${ENV_FILTERS}}[$__range]))`,

// rename commitsByMember -> commitsByDevice
commitsByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.COMMITS}{${ENV_FILTERS}}[$__range]))`,

// rename pullRequestsByMember -> pullRequestsByDevice
pullRequestsByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.PULL_REQUESTS}{${ENV_FILTERS}}[$__range]))`,

// rename activeTimeByMember -> activeTimeByDevice
activeTimeByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.ACTIVE_TIME}{${ENV_FILTERS}}[$__range]))`,

// LANGUAGE — rename toolDecisionsByLanguageAndMember -> toolDecisionsByLanguageAndDevice
toolDecisionsByLanguageAndDevice: `sum by (${LABELS.LANGUAGE}, ${LABELS.DEVICE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

// COST OVER TIME — rename costOverTimeByMember -> costOverTimeByDevice
costOverTimeByDevice: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.DEVICE})`,
```

Delete these old queries entirely: `costByMember`, `costOverTimeByMember`, `tokensByMember`, `sessionsByMember`, `linesOfCodeByMember`, `commitsByMember`, `pullRequestsByMember`, `activeTimeByMember`, `toolDecisionsByLanguageAndMember`.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/queries.ts
git commit -m "feat: make all queries time-range-aware and replace member grouping with device"
```

---

### Task 2: Update OverviewScene to remove `instant: true` and use device grouping

**Files:**
- Modify: `src/scenes/pages/OverviewScene.ts`

- [ ] **Step 1: Remove `instant: true` from all stat query runners**

Remove `instant: true` from: `totalCostQuery`, `totalTokensQuery`, `totalSessionsQuery`, `activeUsersQuery`, `costByMemberQuery`.

For example, `totalCostQuery` changes from:
```typescript
const totalCostQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalCost',
        expr: QUERIES.totalCost,
        instant: true,
      },
    ],
  });
```
to:
```typescript
const totalCostQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalCost',
        expr: QUERIES.totalCost,
      },
    ],
  });
```

Apply the same removal to `totalTokensQuery`, `totalSessionsQuery`, `activeUsersQuery`.

- [ ] **Step 2: Replace `costByMemberQuery` with `costByDeviceQuery`**

```typescript
const costByDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByDevice',
        expr: QUERIES.costByDevice,
        legendFormat: '{{device}}',
      },
    ],
  });
```

- [ ] **Step 3: Update the pie chart panel title and data reference**

Change the pie chart in Row 2 from:
```typescript
.setTitle('Cost by Team Member')
...
.setData(costByMemberQuery)
```
to:
```typescript
.setTitle('Cost by Device')
...
.setData(costByDeviceQuery)
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/pages/OverviewScene.ts
git commit -m "feat: make Overview stat panels time-range-aware, replace member with device"
```

---

### Task 3: Update CostsScene

**Files:**
- Modify: `src/scenes/pages/CostsScene.ts`

- [ ] **Step 1: Remove `instant: true` from all query runners**

Remove `instant: true` from: `totalCostQuery`, `costByModelQuery`, `costByMemberQuery` (which becomes `costByDeviceQuery`), `costTableQuery`.

- [ ] **Step 2: Replace member references with device**

Rename `costByMemberQuery` -> `costByDeviceQuery`:
```typescript
const costByDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByDevice',
        expr: QUERIES.costByDevice,
        legendFormat: '{{device}}',
      },
    ],
  });
```

Rename `costOverTimeByMemberQuery` -> `costOverTimeByDeviceQuery`:
```typescript
const costOverTimeByDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostOverTimeByDevice',
        expr: QUERIES.costOverTimeByDevice,
        legendFormat: '{{device}}',
      },
    ],
  });
```

Update the cost table query to group by device instead of user_email:
```typescript
const costTableQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostTable',
        expr: `sum by (${LABELS.DEVICE}, ${LABELS.MODEL}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,
        format: 'table',
      },
    ],
  });
```

Note: Add `import { LABELS, METRICS } from '../../constants';` — already imported. Also import `ENV_FILTERS` or inline it. Since `ENV_FILTERS` is a const in queries.ts, define the table query inline using the same pattern. Actually, we need to import `ENV_FILTERS` or duplicate the filter string. The simplest approach: add a new query `costTableByDevice` to `queries.ts`:

Add to queries.ts in Step 6 of Task 1:
```typescript
/** Cost breakdown table by device and model */
costTableByDevice: `sum by (${LABELS.DEVICE}, ${LABELS.MODEL}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,
```

Then in CostsScene:
```typescript
const costTableQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostTable',
        expr: QUERIES.costTableByDevice,
        format: 'table',
      },
    ],
  });
```

- [ ] **Step 3: Update panel titles and data references**

- "Cost Over Time by Team Member" -> "Cost Over Time by Device" (use `costOverTimeByDeviceQuery`)
- "Cost Distribution by Member" -> "Cost Distribution by Device" (use `costByDeviceQuery`)
- "Cost Breakdown" table: change the override from `overrideDisplayName('Team Member')` to `overrideDisplayName('Device')` and change `matchFieldsWithName('user_email')` to `matchFieldsWithName('device')`

- [ ] **Step 4: Commit**

```bash
git add src/scenes/pages/CostsScene.ts src/scenes/queries.ts
git commit -m "feat: make Costs panels time-range-aware, replace member with device"
```

---

### Task 4: Update TokensScene

**Files:**
- Modify: `src/scenes/pages/TokensScene.ts`

- [ ] **Step 1: Remove `instant: true` from all query runners**

Remove from: `totalTokensQuery`, `inputTokensQuery`, `outputTokensQuery`, `cacheReadTokensQuery`, `tokensByTypeQuery`, `tokensByModelQuery`, `tokensByMemberQuery`.

- [ ] **Step 2: Update inline token-type queries to use `increase`**

The `inputTokensQuery`, `outputTokensQuery`, and `cacheReadTokensQuery` use inline expressions. Wrap them:

```typescript
const inputTokensQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'InputTokens',
        expr: `sum(increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${LABELS.TOKEN_TYPE}="input", ${ENV_FILTERS}}[$__range]))`,
      },
    ],
  });

const outputTokensQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'OutputTokens',
        expr: `sum(increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${LABELS.TOKEN_TYPE}="output", ${ENV_FILTERS}}[$__range]))`,
      },
    ],
  });

const cacheReadTokensQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CacheReadTokens',
        expr: `sum(increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${LABELS.TOKEN_TYPE}="cache_read", ${ENV_FILTERS}}[$__range]))`,
      },
    ],
  });
```

Note: These inline queries need `ENV_FILTERS`. Since it's defined in queries.ts, we need to either export it or duplicate the filter. **Export `ENV_FILTERS` from queries.ts** by changing `const ENV_FILTERS` to `export const ENV_FILTERS`. Then import it in TokensScene.

- [ ] **Step 3: Replace tokensByMember with tokensByDevice**

```typescript
const tokensByDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TokensByDevice',
        expr: QUERIES.tokensByDevice,
        legendFormat: '{{device}}',
      },
    ],
  });
```

Update panel: "Tokens by Team Member" -> "Tokens by Device", use `tokensByDeviceQuery`.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/pages/TokensScene.ts src/scenes/queries.ts
git commit -m "feat: make Tokens panels time-range-aware, replace member with device"
```

---

### Task 5: Update ToolsScene

**Files:**
- Modify: `src/scenes/pages/ToolsScene.ts`

- [ ] **Step 1: Remove `instant: true` from all query runners**

Remove from: `toolDecisionsQuery`, `toolDecisionsByToolQuery`, `toolAcceptanceRateQuery`, `toolDecisionsBySourceQuery`, `toolDecisionsByLanguageQuery`.

- [ ] **Step 2: Update the inline `toolDecisionsOverTimeQuery`**

This query has an inline expression that's missing `ENV_FILTERS`. Fix it to use QUERIES or add ENV_FILTERS:

```typescript
const toolDecisionsOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsOverTime',
        expr: `sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.DECISION})`,
        legendFormat: '{{decision}}',
      },
    ],
  });
```

Import `ENV_FILTERS` from queries.ts (already being exported from Task 4).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/pages/ToolsScene.ts
git commit -m "feat: make Tools panels time-range-aware"
```

---

### Task 6: Update ProductivityScene

**Files:**
- Modify: `src/scenes/pages/ProductivityScene.ts`

- [ ] **Step 1: Remove `instant: true` from all query runners**

Remove from: `totalLinesOfCodeQuery`, `totalCommitsQuery`, `totalPullRequestsQuery`, `totalActiveTimeQuery`, `linesOfCodeByTypeQuery`, `activeTimeByMemberQuery`.

- [ ] **Step 2: Replace activeTimeByMember with activeTimeByDevice**

```typescript
const activeTimeByDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ActiveTimeByDevice',
        expr: QUERIES.activeTimeByDevice,
        legendFormat: '{{device}}',
      },
    ],
  });
```

Update panel: "Active Time by Team Member" -> "Active Time by Device", use `activeTimeByDeviceQuery`.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/pages/ProductivityScene.ts
git commit -m "feat: make Productivity panels time-range-aware, replace member with device"
```

---

### Task 7: Update LanguagesScene

**Files:**
- Modify: `src/scenes/pages/LanguagesScene.ts`

- [ ] **Step 1: Remove `instant: true` from all query runners**

Remove from: `totalLanguagesQuery`, `toolDecisionsByLanguageQuery`, `languageAcceptanceRateQuery`, `toolDecisionsByLanguageAndMemberQuery`.

- [ ] **Step 2: Replace languageAndMember with languageAndDevice**

```typescript
const toolDecisionsByLanguageAndDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByLanguageAndDevice',
        expr: QUERIES.toolDecisionsByLanguageAndDevice,
        legendFormat: '{{language}} - {{device}}',
      },
    ],
  });
```

Update panel: "Language Usage by Team Member" -> "Language Usage by Device", use `toolDecisionsByLanguageAndDeviceQuery`.

Update table override: `matchFieldsWithName('user_email').overrideDisplayName('Team Member')` -> `matchFieldsWithName('device').overrideDisplayName('Device')`

- [ ] **Step 3: Commit**

```bash
git add src/scenes/pages/LanguagesScene.ts
git commit -m "feat: make Languages panels time-range-aware, replace member with device"
```

---

### Task 8: Update EnvironmentScene

**Files:**
- Modify: `src/scenes/pages/EnvironmentScene.ts`

- [ ] **Step 1: Remove `instant: true` from all query runners**

Remove from: `usageByOsTypeQuery`, `usageByHostArchQuery`, `usageByTerminalTypeQuery`, `usageByServiceVersionQuery`, `costByTerminalTypeQuery`, `costByOsTypeQuery`, `usageByDeviceQuery`, `costByDeviceQuery`.

- [ ] **Step 2: Commit**

```bash
git add src/scenes/pages/EnvironmentScene.ts
git commit -m "feat: make Environment panels time-range-aware"
```

---

### Task 9: Change default time range to 7 days

**Files:**
- Modify: `src/components/scenes/SceneAppPage.tsx`

- [ ] **Step 1: Update SceneTimeRange**

Change line 24 from:
```typescript
const timeRange = new SceneTimeRange({ from: 'now-3h', to: 'now' });
```
to:
```typescript
const timeRange = new SceneTimeRange({ from: 'now-7d', to: 'now' });
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scenes/SceneAppPage.tsx
git commit -m "feat: change default time range from 3h to 7d"
```

---

### Task 10: Export ENV_FILTERS from queries.ts

**Files:**
- Modify: `src/scenes/queries.ts`

This is needed by Tasks 4 and 5 for inline queries that reference `ENV_FILTERS`.

- [ ] **Step 1: Make ENV_FILTERS exported**

Change line 6 from:
```typescript
const ENV_FILTERS = `${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device"`;
```
to:
```typescript
export const ENV_FILTERS = `${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device"`;
```

- [ ] **Step 2: Commit**

```bash
git add src/scenes/queries.ts
git commit -m "refactor: export ENV_FILTERS for use in scene files"
```

**Note:** This task should be done as part of Task 1 (or immediately after) since Tasks 4 and 5 depend on it.

---

### Task 11: Set Prometheus retention to 90 days on Hetzner

**Files:**
- Modify: Docker Compose config on server `162.55.221.167:/opt/claude-stats/docker-compose.yaml`

- [ ] **Step 1: SSH into server and update Prometheus command**

Add `--storage.tsdb.retention.time=90d` to the Prometheus service command:

```yaml
prometheus:
    image: prom/prometheus:latest
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--web.enable-remote-write-receiver'
      - '--storage.tsdb.retention.time=90d'
```

- [ ] **Step 2: Restart Prometheus**

```bash
ssh root@162.55.221.167 'cd /opt/claude-stats && docker compose restart prometheus'
```

- [ ] **Step 3: Verify retention setting**

```bash
ssh root@162.55.221.167 'docker compose -f /opt/claude-stats/docker-compose.yaml logs prometheus | grep retention'
```

Expected: log line showing `retention=90d` or similar.

---

### Task 12: Build, verify, and deploy

**Files:**
- All modified files

- [ ] **Step 1: Run TypeScript compilation check**

```bash
cd /Users/keanu/code/claudestats-app-grafana && node_modules/typescript/bin/tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Deploy to Hetzner Grafana**

```bash
scp -r dist root@162.55.221.167:/opt/claude-stats/plugin/timurdigital-claudestats-app/
ssh root@162.55.221.167 'cd /opt/claude-stats && docker compose restart grafana'
```

- [ ] **Step 4: Verify in browser**

1. Open http://162.55.221.167:3000
2. Navigate to Claude Stats plugin
3. Select "Last 24 hours" — stat panels should show only today's values
4. Select "Last 7 days" — stat panels should show the week's values (this is the new default)
5. Verify "Cost by Device" shows `keanu-macbook` instead of email
6. Check each tab (Costs, Tokens, Tools, Productivity, Languages, Environment)
