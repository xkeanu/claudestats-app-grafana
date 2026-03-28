# Plugin Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Claude Stats plugin with visual polish (smoothing, auto-refresh), new analytics (Sessions tab, LOC per language, tool source expansion), and author rename.

**Architecture:** Incremental changes to an existing Grafana Scenes plugin. New queries in `queries.ts`, one new scene file (`SessionsScene.ts`), modifications to 4 existing scenes, and metadata updates. All changes follow established patterns.

**Tech Stack:** TypeScript, @grafana/scenes, @grafana/schema, Prometheus/PromQL

---

### Task 1: Rename author in plugin.json

**Files:**
- Modify: `src/plugin.json`

- [ ] **Step 1: Update author name**

In `src/plugin.json`, change the author object:

```json
"author": {
  "name": "xkeanu"
},
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add src/plugin.json
git commit -m "chore: rename plugin author to xkeanu"
```

---

### Task 2: Enable auto-refresh default

**Files:**
- Modify: `src/components/scenes/SceneAppPage.tsx:114`

- [ ] **Step 1: Add default refresh interval**

In `src/components/scenes/SceneAppPage.tsx`, every scene's `SceneRefreshPicker` currently has no default. However, the refresh picker is inside each scene file, not in `SceneAppPage.tsx`. The centralized approach is to set auto-refresh on each scene's `SceneRefreshPicker`.

Since all 8 scene files (including the new SessionsScene) have identical `SceneRefreshPicker` construction, add `refresh: '1m'` to each. Start with `OverviewScene.ts` as the pattern.

In `src/scenes/pages/OverviewScene.ts` line 114, change:

```typescript
      new SceneRefreshPicker({ intervals: ['30s', '1m', '5m', '15m', '30m'] }),
```

to:

```typescript
      new SceneRefreshPicker({ refresh: '1m', intervals: ['30s', '1m', '5m', '15m', '30m'] }),
```

- [ ] **Step 2: Apply the same change to all other scene files**

Apply the identical change (`refresh: '1m'` added) in:

- `src/scenes/pages/CostsScene.ts` — the `SceneRefreshPicker` line
- `src/scenes/pages/TokensScene.ts` — the `SceneRefreshPicker` line
- `src/scenes/pages/ToolsScene.ts` — the `SceneRefreshPicker` line
- `src/scenes/pages/ProductivityScene.ts` — the `SceneRefreshPicker` line
- `src/scenes/pages/LanguagesScene.ts` — the `SceneRefreshPicker` line
- `src/scenes/pages/EnvironmentScene.ts` — the `SceneRefreshPicker` line

Each file has the same pattern: `new SceneRefreshPicker({ intervals: ['30s', '1m', '5m', '15m', '30m'] })`. Add `refresh: '1m',` before `intervals`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/scenes/pages/OverviewScene.ts src/scenes/pages/CostsScene.ts src/scenes/pages/TokensScene.ts src/scenes/pages/ToolsScene.ts src/scenes/pages/ProductivityScene.ts src/scenes/pages/LanguagesScene.ts src/scenes/pages/EnvironmentScene.ts
git commit -m "feat: enable 1-minute auto-refresh by default on all scenes"
```

---

### Task 3: Add smooth line interpolation to all trend charts

**Files:**
- Modify: `src/scenes/pages/OverviewScene.ts`
- Modify: `src/scenes/pages/CostsScene.ts`
- Modify: `src/scenes/pages/TokensScene.ts`
- Modify: `src/scenes/pages/ToolsScene.ts`
- Modify: `src/scenes/pages/ProductivityScene.ts`
- Modify: `src/scenes/pages/LanguagesScene.ts`
- Modify: `src/scenes/pages/EnvironmentScene.ts`

The `LineInterpolation` enum is available from `@grafana/schema`. Add it to each file's imports and apply `.setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)` to every `PanelBuilders.timeseries()` that renders continuous trend data. Do NOT apply to `GraphDrawStyle.Bars` panels (commits/PRs in ProductivityScene).

- [ ] **Step 1: Add smoothing to OverviewScene.ts**

Add `LineInterpolation` to the import from `@grafana/schema` (line 14):

```typescript
import { BigValueGraphMode, LegendDisplayMode, LineInterpolation, StackingMode } from '@grafana/schema';
```

Add `.setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)` to all 3 timeseries panels:

1. **Cost Over Time** (line 166-171) — add before `.build()`:
```typescript
              body: PanelBuilders.timeseries()
                .setTitle('Cost Over Time')
                .setUnit('currencyUSD')
                .setData(costOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
```

2. **Token Usage Over Time** (line 191-197) — add before `.build()`:
```typescript
              body: PanelBuilders.timeseries()
                .setTitle('Token Usage Over Time')
                .setUnit('short')
                .setData(tokensOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
```

3. **Active Time Over Time** (line 201-208) — add before `.build()`:
```typescript
              body: PanelBuilders.timeseries()
                .setTitle('Active Time Over Time')
                .setUnit('s')
                .setData(activeTimeByTypeOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 20)
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
```

- [ ] **Step 2: Add smoothing to CostsScene.ts**

Add `LineInterpolation` to the `@grafana/schema` import. Add `.setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)` to both "Cost Over Time by Model" and "Cost Over Time by Device" timeseries panels.

- [ ] **Step 3: Add smoothing to TokensScene.ts**

Add `LineInterpolation` to the `@grafana/schema` import. Add `.setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)` to the "Token Usage Over Time" timeseries panel.

- [ ] **Step 4: Add smoothing to ToolsScene.ts**

Add `LineInterpolation` to the `@grafana/schema` import. Add `.setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)` to the "Tool Decisions Over Time" (Row 2) and "Decision Source Over Time" (Row 3) timeseries panels.

- [ ] **Step 5: Add smoothing to ProductivityScene.ts**

Add `LineInterpolation` to the `@grafana/schema` import. Add `.setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)` to the "Lines of Code Over Time" timeseries panel ONLY. Do NOT touch the Commits Over Time or Pull Requests Over Time panels (they use `GraphDrawStyle.Bars`).

- [ ] **Step 6: Add smoothing to LanguagesScene.ts**

Add `LineInterpolation` to the `@grafana/schema` import. Add `.setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)` to the "Language Usage Over Time" timeseries panel.

- [ ] **Step 7: Add smoothing to EnvironmentScene.ts**

Add `LineInterpolation` to the `@grafana/schema` import. Add `.setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)` to the "IDE / Terminal Usage Over Time" and "Version Adoption Over Time" timeseries panels.

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 9: Commit**

```bash
git add src/scenes/pages/OverviewScene.ts src/scenes/pages/CostsScene.ts src/scenes/pages/TokensScene.ts src/scenes/pages/ToolsScene.ts src/scenes/pages/ProductivityScene.ts src/scenes/pages/LanguagesScene.ts src/scenes/pages/EnvironmentScene.ts
git commit -m "feat: add smooth line interpolation to all trend timeseries charts"
```

---

### Task 4: Add new queries to queries.ts

**Files:**
- Modify: `src/scenes/queries.ts`

- [ ] **Step 1: Add session queries**

Add the following after the `// ==================== ACTIVITY QUERIES ====================` section (after line 100) and before the `// ==================== TOOL QUERIES ====================` section:

```typescript
  // ==================== SESSION ANALYTICS QUERIES ====================

  /** Average tokens per session */
  avgTokensPerSession: `sum(increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range])) / sum(increase(${METRICS.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Average active time per session */
  avgActiveTimePerSession: `sum(increase(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])) / sum(increase(${METRICS.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Average cost per session */
  avgCostPerSession: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range])) / sum(increase(${METRICS.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Sessions over time by device */
  sessionsOverTime: `sum by (${LABELS.DEVICE}) (increase(${METRICS.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]))`,

  /** Session intensity (avg tokens per session) over time */
  sessionIntensityOverTime: `sum(increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval])) / sum(increase(${METRICS.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]))`,

  /** Sessions by model */
  sessionsByModel: `sum by (${LABELS.MODEL}) (increase(${METRICS.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  /** Active users over time */
  activeUsersOverTime: `count(count by (${LABELS.USER_EMAIL}) (increase(${METRICS.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]) > 0))`,
```

- [ ] **Step 2: Add LOC per language queries**

Add the following after the `// ==================== LANGUAGE QUERIES ====================` section (after line 128):

```typescript
  // ==================== LANGUAGE LOC QUERIES ====================

  /** Lines of code by language (total) */
  linesOfCodeByLanguage: `sum by (${LABELS.LANGUAGE}) (increase(${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

  /** Lines of code by language and type (added/removed) */
  linesOfCodeByLanguageAndType: `sum by (${LABELS.LANGUAGE}, ${LABELS.LOC_TYPE}) (increase(${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

  /** Lines of code by language over time */
  linesOfCodeByLanguageOverTime: `sum by (${LABELS.LANGUAGE}) (increase(${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__rate_interval]))`,
```

- [ ] **Step 3: Add tool source per tool query**

Add the following in the `// ==================== ENHANCED TOOL QUERIES ====================` section (after line 139):

```typescript
  /** Tool decisions by tool and source (how each tool's decisions were made) */
  toolDecisionsByToolAndSource: `sum by (${LABELS.TOOL}, ${LABELS.DECISION_SOURCE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/scenes/queries.ts
git commit -m "feat: add queries for sessions analytics, LOC per language, and tool source per tool"
```

---

### Task 5: Add Sessions route to constants.ts

**Files:**
- Modify: `src/constants.ts:5-13`

- [ ] **Step 1: Add Sessions route**

In `src/constants.ts`, add `Sessions` to the `ROUTES` object after `Productivity`:

```typescript
export const ROUTES = {
  Overview: '',
  Costs: 'costs',
  Tokens: 'tokens',
  Tools: 'tools',
  Productivity: 'productivity',
  Sessions: 'sessions',
  Languages: 'languages',
  Environment: 'environment',
} as const;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/constants.ts
git commit -m "feat: add Sessions route to constants"
```

---

### Task 6: Create SessionsScene.ts

**Files:**
- Create: `src/scenes/pages/SessionsScene.ts`

- [ ] **Step 1: Create the Sessions scene file**

Create `src/scenes/pages/SessionsScene.ts`:

```typescript
import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  PanelBuilders,
  VariableValueSelectors,
  SceneControlsSpacer,
  SceneTimePicker,
  SceneRefreshPicker,
} from '@grafana/scenes';
import { BigValueGraphMode, LegendDisplayMode, LineInterpolation, StackingMode } from '@grafana/schema';
import { QUERIES } from '../queries';
import { PANEL_HEIGHTS } from '../../constants';

export function getSessionsScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet
): EmbeddedScene {
  const totalSessionsQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalSessions',
        expr: QUERIES.totalSessions,
      },
    ],
  });

  const avgTokensPerSessionQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'AvgTokensPerSession',
        expr: QUERIES.avgTokensPerSession,
      },
    ],
  });

  const avgActiveTimePerSessionQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'AvgActiveTimePerSession',
        expr: QUERIES.avgActiveTimePerSession,
      },
    ],
  });

  const avgCostPerSessionQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'AvgCostPerSession',
        expr: QUERIES.avgCostPerSession,
      },
    ],
  });

  const sessionsOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'SessionsOverTime',
        expr: QUERIES.sessionsOverTime,
        legendFormat: '{{device}}',
      },
    ],
  });

  const sessionIntensityOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'SessionIntensityOverTime',
        expr: QUERIES.sessionIntensityOverTime,
      },
    ],
  });

  const sessionsByDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'SessionsByDevice',
        expr: QUERIES.sessionsByDevice,
        legendFormat: '{{device}}',
      },
    ],
  });

  const sessionsByModelQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'SessionsByModel',
        expr: QUERIES.sessionsByModel,
        legendFormat: '{{model}}',
      },
    ],
  });

  const activeUsersOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ActiveUsersOverTime',
        expr: QUERIES.activeUsersOverTime,
      },
    ],
  });

  return new EmbeddedScene({
    $timeRange: timeRange,
    $variables: variables,
    controls: [
      new VariableValueSelectors({}),
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({ refresh: '1m', intervals: ['30s', '1m', '5m', '15m', '30m'] }),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        // Row 1: Stats
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.STAT,
          children: [
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Total Sessions')
                .setUnit('short')
                .setData(totalSessionsQuery)
                .setOption('graphMode', BigValueGraphMode.Area)
                .setColor({ fixedColor: 'blue', mode: 'fixed' })
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Avg Tokens / Session')
                .setUnit('short')
                .setData(avgTokensPerSessionQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .setColor({ fixedColor: 'green', mode: 'fixed' })
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Avg Duration / Session')
                .setUnit('s')
                .setData(avgActiveTimePerSessionQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .setColor({ fixedColor: 'purple', mode: 'fixed' })
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Avg Cost / Session')
                .setUnit('currencyUSD')
                .setData(avgCostPerSessionQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .setColor({ fixedColor: 'orange', mode: 'fixed' })
                .build(),
            }),
          ],
        }),
        // Row 2: Trends
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '60%',
              body: PanelBuilders.timeseries()
                .setTitle('Sessions Over Time')
                .setUnit('short')
                .setData(sessionsOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
            new SceneFlexItem({
              width: '40%',
              body: PanelBuilders.timeseries()
                .setTitle('Session Intensity (Tokens/Session)')
                .setUnit('short')
                .setData(sessionIntensityOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('fillOpacity', 20)
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
          ],
        }),
        // Row 3: Breakdowns
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '40%',
              body: PanelBuilders.piechart()
                .setTitle('Sessions by Device')
                .setUnit('short')
                .setData(sessionsByDeviceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '30%',
              body: PanelBuilders.piechart()
                .setTitle('Sessions by Model')
                .setUnit('short')
                .setData(sessionsByModelQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .build(),
            }),
            new SceneFlexItem({
              width: '30%',
              body: PanelBuilders.timeseries()
                .setTitle('Active Users Over Time')
                .setUnit('short')
                .setData(activeUsersOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('fillOpacity', 20)
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
          ],
        }),
      ],
    }),
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/scenes/pages/SessionsScene.ts
git commit -m "feat: create Sessions scene with intensity and breakdown analytics"
```

---

### Task 7: Wire Sessions tab into SceneAppPage

**Files:**
- Modify: `src/components/scenes/SceneAppPage.tsx:1-78`

- [ ] **Step 1: Add import and tab**

In `src/components/scenes/SceneAppPage.tsx`:

Add the import (after line 16):
```typescript
import { getSessionsScene } from '../../scenes/pages/SessionsScene';
```

Add the Sessions tab after the Productivity tab (after line 65, before the Languages tab):
```typescript
          new SceneAppPage({
            title: 'Sessions',
            url: prefixRoute(ROUTES.Sessions),
            routePath: `/${ROUTES.Sessions}`,
            getScene: () => getSessionsScene(timeRange, variables),
          }),
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/scenes/SceneAppPage.tsx
git commit -m "feat: register Sessions tab in scene app navigation"
```

---

### Task 8: Add LOC per language to LanguagesScene

**Files:**
- Modify: `src/scenes/pages/LanguagesScene.ts`

- [ ] **Step 1: Add LineInterpolation import**

Add `LineInterpolation` to the `@grafana/schema` import (line 14):

```typescript
import {
  BigValueGraphMode,
  LegendDisplayMode,
  LineInterpolation,
  StackingMode,
  BarGaugeDisplayMode,
  BarGaugeValueMode,
  VizOrientation,
} from '@grafana/schema';
```

- [ ] **Step 2: Add new query runners**

Add after the `toolDecisionsByLanguageAndDeviceQuery` definition (after line 81):

```typescript
  const linesOfCodeByLanguageQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'LinesOfCodeByLanguage',
        expr: QUERIES.linesOfCodeByLanguage,
        legendFormat: '{{language}}',
      },
    ],
  });

  const linesOfCodeByLanguageAndTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'LinesOfCodeByLanguageAndType',
        expr: QUERIES.linesOfCodeByLanguageAndType,
        legendFormat: '{{language}} - {{type}}',
      },
    ],
  });

  const linesOfCodeByLanguageOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'LinesOfCodeByLanguageOverTime',
        expr: QUERIES.linesOfCodeByLanguageOverTime,
        legendFormat: '{{language}}',
      },
    ],
  });
```

- [ ] **Step 3: Add LOC rows before the table row**

Insert two new rows between Row 2 (language trends) and Row 3 (table). In the `children` array of the body layout, before the `// Row 3: Language by member table` comment, add:

```typescript
        // Row 3: Lines of code by language
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '40%',
              body: PanelBuilders.piechart()
                .setTitle('Lines of Code by Language')
                .setUnit('short')
                .setData(linesOfCodeByLanguageQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '60%',
              body: PanelBuilders.bargauge()
                .setTitle('Lines Added vs Removed by Language')
                .setUnit('short')
                .setData(linesOfCodeByLanguageAndTypeQuery)
                .setOption('displayMode', BarGaugeDisplayMode.Gradient)
                .setOption('orientation', VizOrientation.Horizontal)
                .setOption('valueMode', BarGaugeValueMode.Text)
                .setOption('showUnfilled', true)
                .setOption('minVizWidth', 150)
                .setOption('minVizHeight', 25)
                .setDisplayName('${__series.name}')
                .build(),
            }),
          ],
        }),
        // Row 4: LOC by language over time
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              body: PanelBuilders.timeseries()
                .setTitle('Lines of Code by Language Over Time')
                .setUnit('short')
                .setData(linesOfCodeByLanguageOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
          ],
        }),
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/scenes/pages/LanguagesScene.ts
git commit -m "feat: add LOC per language charts to Languages scene"
```

---

### Task 9: Add LOC language summary to ProductivityScene

**Files:**
- Modify: `src/scenes/pages/ProductivityScene.ts`

- [ ] **Step 1: Add new query runner**

Add after the `activeTimeByDeviceQuery` definition (after line 121):

```typescript
  const linesOfCodeByLanguageQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'LinesOfCodeByLanguage',
        expr: QUERIES.linesOfCodeByLanguage,
        legendFormat: '{{language}}',
      },
    ],
  });
```

- [ ] **Step 2: Modify Row 2 layout**

Change Row 2 (lines 179-205) to include the new piechart. Update the widths and add the new panel:

```typescript
        // Row 2: Lines of code charts
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Lines Added vs Removed')
                .setUnit('short')
                .setData(linesOfCodeByTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '45%',
              body: PanelBuilders.timeseries()
                .setTitle('Lines of Code Over Time')
                .setUnit('short')
                .setData(linesOfCodeOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
            new SceneFlexItem({
              width: '30%',
              body: PanelBuilders.piechart()
                .setTitle('Top Languages by LOC')
                .setUnit('short')
                .setData(linesOfCodeByLanguageQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .build(),
            }),
          ],
        }),
```

- [ ] **Step 3: Add LineInterpolation import**

Add `LineInterpolation` to the `@grafana/schema` import (line 14):

```typescript
import {
  BigValueGraphMode,
  LegendDisplayMode,
  LineInterpolation,
  StackingMode,
  GraphDrawStyle,
  BarGaugeDisplayMode,
  BarGaugeValueMode,
  VizOrientation,
} from '@grafana/schema';
```

Note: `LineInterpolation` may already be added from Task 3. If so, skip this step.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/scenes/pages/ProductivityScene.ts
git commit -m "feat: add Top Languages by LOC piechart to Productivity scene"
```

---

### Task 10: Expand tool decision source views in ToolsScene

**Files:**
- Modify: `src/scenes/pages/ToolsScene.ts`

- [ ] **Step 1: Add new query runner**

Add after the `toolDecisionsByLanguageQuery` definition (after line 103):

```typescript
  const toolDecisionsByToolAndSourceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByToolAndSource',
        expr: QUERIES.toolDecisionsByToolAndSource,
        legendFormat: '{{tool_name}} - {{source}}',
      },
    ],
  });
```

- [ ] **Step 2: Add value mappings to source piechart and timeline in Row 3**

In the existing Row 3, update the "Decisions by Source" piechart (line ~187-191) to add value mappings for human-readable labels. Add `.setOverrides` after the legend option:

```typescript
              body: PanelBuilders.piechart()
                .setTitle('Decisions by Source')
                .setData(toolDecisionsBySourceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .setOverrides((b) =>
                  b
                    .matchFieldsWithName('config').overrideDisplayName('Auto (Config)')
                    .matchFieldsWithName('hook').overrideDisplayName('Auto (Hook)')
                    .matchFieldsWithName('user_permanent').overrideDisplayName('User (Always)')
                    .matchFieldsWithName('user_temporary').overrideDisplayName('User (Once)')
                    .matchFieldsWithName('user_abort').overrideDisplayName('User (Abort)')
                    .matchFieldsWithName('user_reject').overrideDisplayName('User (Reject)')
                )
                .build(),
```

Apply the same `.setOverrides()` block to the "Decision Source Over Time" timeseries panel in Row 3 (line ~195-202).

- [ ] **Step 3: Replace Row 4**

Replace the current Row 4 (lines 206-219):

```typescript
        // Row 4: Source per tool + Language breakdown
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '60%',
              body: PanelBuilders.bargauge()
                .setTitle('Source Breakdown per Tool')
                .setUnit('short')
                .setData(toolDecisionsByToolAndSourceQuery)
                .setOption('displayMode', BarGaugeDisplayMode.Gradient)
                .setOption('orientation', VizOrientation.Horizontal)
                .setOption('valueMode', BarGaugeValueMode.Text)
                .setOption('showUnfilled', true)
                .setOption('minVizWidth', 150)
                .setOption('minVizHeight', 25)
                .setDisplayName('${__series.name}')
                .build(),
            }),
            new SceneFlexItem({
              width: '40%',
              body: PanelBuilders.piechart()
                .setTitle('Tool Decisions by Language')
                .setData(toolDecisionsByLanguageQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
          ],
        }),
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/scenes/pages/ToolsScene.ts
git commit -m "feat: add source breakdown per tool and restructure Row 4 in Tools scene"
```

---

### Task 11: Update AGENTS.md documentation

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update AGENTS.md**

Update the following sections:

1. In **Dashboard Scenes** list, add after Productivity:
   ```
   8. **Sessions** - Session analytics with per-session averages (tokens, duration, cost), session trends over time, intensity metrics, and device/model breakdowns
   ```

2. In the **Project Structure** section, add `SessionsScene.ts` to the pages list.

3. In the **Implemented Features > Dashboard Scenes** section, update the Sessions entry.

4. Note the smooth line interpolation and auto-refresh defaults in a brief note.

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md with Sessions tab and enhancement details"
```

---

### Task 12: Final verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Build succeeds with no errors or warnings

- [ ] **Step 2: Dev server check**

Run: `npm run dev`
Expected: Dev server starts successfully. Verify in Grafana that:
- All 8 tabs render (Overview, Costs, Tokens, Tools, Productivity, Sessions, Languages, Environment)
- Charts show smooth interpolation on trend panels
- Auto-refresh is active (1m)
- Sessions tab shows stat panels and charts
- Languages page has LOC-by-language rows
- Productivity page shows Top Languages piechart
- Tools page Row 4 has source breakdown per tool + language piechart side by side

- [ ] **Step 3: Final commit if any fixes needed**

If any fixes were needed during verification, commit them.
