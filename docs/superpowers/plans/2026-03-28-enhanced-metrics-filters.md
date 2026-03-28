# Enhanced Metrics & Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Claude Stats plugin with new filter variables (IDE/Terminal, OS, Device), a dedicated Languages tab, enriched Tools tab (language + decision source), a dedicated Environment tab, active time type breakdown, and custom device name support via `OTEL_RESOURCE_ATTRIBUTES`.

**Architecture:** Add new labels and queries to the existing constants/queries layer. Add two new scene tabs (Languages, Environment). Enhance the existing Tools and Overview scenes. Add three new filter variables (terminal_type, os_type, device) to the shared variable set so all scenes can filter by IDE/OS/device. Device names are user-defined via `OTEL_RESOURCE_ATTRIBUTES="device=my-macbook"` — this becomes a Prometheus label on all metrics.

**Tech Stack:** React, @grafana/scenes, Prometheus PromQL, TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/constants.ts` | Add new labels (`language`, `source`, `active_time_type`, `device`), new routes (`Languages`, `Environment`) |
| Modify | `src/scenes/queries.ts` | Add ~15 new PromQL queries for languages, environment, enhanced tools, active time breakdown, device |
| Modify | `src/scenes/variables.ts` | Add `terminal_type`, `os_type`, and `device` filter variables, propagate to all queries |
| Create | `src/scenes/pages/LanguagesScene.ts` | New Languages tab scene |
| Create | `src/scenes/pages/EnvironmentScene.ts` | New Environment tab scene (extracted + expanded from Overview) |
| Modify | `src/scenes/pages/ToolsScene.ts` | Add language breakdown row and decision source panels |
| Modify | `src/scenes/pages/OverviewScene.ts` | Remove environment row (moved to dedicated tab), add active time type breakdown |
| Modify | `src/components/scenes/SceneAppPage.tsx` | Register Languages and Environment tabs |

---

### Task 1: Add New Labels and Routes to Constants

**Files:**
- Modify: `src/constants.ts`

- [ ] **Step 1: Add new labels to LABELS object**

```typescript
// In LABELS object, add after TERMINAL_TYPE:
  LANGUAGE: 'language',
  DECISION_SOURCE: 'source',
  ACTIVE_TIME_TYPE: 'type', // user (keyboard), cli (tool execution/AI)
  DEVICE: 'device', // custom resource attribute via OTEL_RESOURCE_ATTRIBUTES="device=my-macbook"
```

- [ ] **Step 2: Add new routes to ROUTES object**

```typescript
// In ROUTES object, add after Productivity:
  Languages: 'languages',
  Environment: 'environment',
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npx tsc --noEmit src/constants.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/constants.ts
git commit -m "feat: add language, source, active_time_type labels and new routes"
```

---

### Task 2: Add New Filter Variables (Terminal Type, OS Type)

**Files:**
- Modify: `src/scenes/variables.ts`

- [ ] **Step 1: Add terminal type filter variable**

Add this function after `getModelVariable()`:

```typescript
/**
 * Creates a terminal/IDE filter variable
 */
export function getTerminalTypeVariable() {
  return new QueryVariable({
    name: 'terminal_type',
    label: 'IDE / Terminal',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values(${METRICS.COST_USAGE}, ${LABELS.TERMINAL_TYPE})`,
      refId: 'TerminalTypeQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}
```

- [ ] **Step 2: Add OS type filter variable**

Add this function after `getTerminalTypeVariable()`:

```typescript
/**
 * Creates an OS type filter variable
 */
export function getOsTypeVariable() {
  return new QueryVariable({
    name: 'os_type',
    label: 'OS',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values(${METRICS.COST_USAGE}, ${LABELS.OS_TYPE})`,
      refId: 'OsTypeQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}
```

- [ ] **Step 3: Add device filter variable**

Add this function after `getOsTypeVariable()`:

```typescript
/**
 * Creates a device name filter variable
 * Users set device names via OTEL_RESOURCE_ATTRIBUTES="device=my-macbook"
 */
export function getDeviceVariable() {
  return new QueryVariable({
    name: 'device',
    label: 'Device',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values(${METRICS.COST_USAGE}, ${LABELS.DEVICE})`,
      refId: 'DeviceQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}
```

- [ ] **Step 4: Add new variables to shared variable set**

Update `getSharedVariables()`:

```typescript
export function getSharedVariables() {
  return new SceneVariableSet({
    variables: [
      getPrometheusDataSourceVariable(),
      getTeamMemberVariable(),
      getModelVariable(),
      getTerminalTypeVariable(),
      getOsTypeVariable(),
      getDeviceVariable(),
    ],
  });
}
```

- [ ] **Step 4: Verify the file compiles**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npx tsc --noEmit src/scenes/variables.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/scenes/variables.ts
git commit -m "feat: add terminal_type and os_type filter variables"
```

---

### Task 3: Add New PromQL Queries

**Files:**
- Modify: `src/scenes/queries.ts`

- [ ] **Step 1: Update existing queries to include new filter variables**

All existing queries that filter by `$member` and/or `$model` need to also filter by `$terminal_type` and `$os_type`. Update every query expression to include `${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device"` in the label matchers.

For example, `totalCost` changes from:
```typescript
totalCost: `sum(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model"})`,
```
to:
```typescript
totalCost: `sum(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device"})`,
```

Apply this pattern to ALL existing queries. For queries that only filter by `$member` (like productivity queries), add both new filters. For queries that have no filters at all (like `sessionsByMember`, `commitsByMember`), add the new filters.

- [ ] **Step 2: Add language queries**

Add these after the TOOL QUERIES section:

```typescript
  // ==================== LANGUAGE QUERIES ====================

  /** Tool decisions by programming language */
  toolDecisionsByLanguage: `sum by (${LABELS.LANGUAGE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device", ${LABELS.LANGUAGE}!=""})`,

  /** Tool decisions by language over time */
  toolDecisionsByLanguageOverTime: `sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device", ${LABELS.LANGUAGE}!=""}[$__rate_interval])) by (${LABELS.LANGUAGE})`,

  /** Tool decisions by language and member */
  toolDecisionsByLanguageAndMember: `sum by (${LABELS.LANGUAGE}, ${LABELS.USER_EMAIL}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device", ${LABELS.LANGUAGE}!=""})`,

  /** Language acceptance rate */
  languageAcceptanceRate: `sum by (${LABELS.LANGUAGE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device", ${LABELS.DECISION}="accept", ${LABELS.LANGUAGE}!=""}) / sum by (${LABELS.LANGUAGE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device", ${LABELS.LANGUAGE}!=""}) * 100`,

  /** Total unique languages */
  totalLanguages: `count(count by (${LABELS.LANGUAGE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device", ${LABELS.LANGUAGE}!=""}))`,
```

- [ ] **Step 3: Add enhanced tool queries**

Add after language queries:

```typescript
  // ==================== ENHANCED TOOL QUERIES ====================

  /** Tool decisions by source (how the decision was made) */
  toolDecisionsBySource: `sum by (${LABELS.DECISION_SOURCE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device"})`,

  /** Tool decisions by source over time */
  toolDecisionsBySourceOverTime: `sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device"}[$__rate_interval])) by (${LABELS.DECISION_SOURCE})`,

  /** Tool decisions by language (for Tools scene) */
  toolDecisionsByToolAndLanguage: `sum by (${LABELS.TOOL}, ${LABELS.LANGUAGE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device", ${LABELS.LANGUAGE}!=""})`,
```

- [ ] **Step 4: Add active time breakdown queries**

Add after enhanced tool queries:

```typescript
  // ==================== ACTIVE TIME BREAKDOWN ====================

  /** Active time by type (user keyboard vs cli tool execution) */
  activeTimeByType: `sum by (${LABELS.ACTIVE_TIME_TYPE}) (${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device"})`,

  /** Active time by type over time */
  activeTimeByTypeOverTime: `sum(increase(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device"}[$__rate_interval])) by (${LABELS.ACTIVE_TIME_TYPE})`,
```

- [ ] **Step 5: Add enhanced environment queries**

Add after active time queries:

```typescript
  // ==================== ENHANCED ENVIRONMENT QUERIES ====================

  /** Cost by terminal type */
  costByTerminalType: `sum by (${LABELS.TERMINAL_TYPE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model"})`,

  /** Sessions by terminal type */
  sessionsByTerminalType: `count by (${LABELS.TERMINAL_TYPE}) (count by (${LABELS.SESSION_ID}, ${LABELS.TERMINAL_TYPE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member"}))`,

  /** Members by OS type */
  membersByOsType: `count by (${LABELS.OS_TYPE}) (count by (${LABELS.USER_EMAIL}, ${LABELS.OS_TYPE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member"}))`,

  /** Cost by OS type */
  costByOsType: `sum by (${LABELS.OS_TYPE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model"})`,

  /** Version adoption over time */
  versionAdoptionOverTime: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member"}[$__rate_interval])) by (${LABELS.SERVICE_VERSION})`,

  /** Terminal type usage over time */
  terminalTypeOverTime: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member"}[$__rate_interval])) by (${LABELS.TERMINAL_TYPE})`,

  /** Usage by device */
  usageByDevice: `sum by (${LABELS.DEVICE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.DEVICE}!=""})`,

  /** Cost by device */
  costByDevice: `sum by (${LABELS.DEVICE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${LABELS.DEVICE}!=""})`,
```

- [ ] **Step 6: Verify the file compiles**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npx tsc --noEmit src/scenes/queries.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/scenes/queries.ts
git commit -m "feat: add language, enhanced tool, active time, and environment queries"
```

---

### Task 4: Create Languages Scene

**Files:**
- Create: `src/scenes/pages/LanguagesScene.ts`

- [ ] **Step 1: Create the Languages scene file**

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
import {
  BigValueGraphMode,
  LegendDisplayMode,
  StackingMode,
  BarGaugeDisplayMode,
  BarGaugeValueMode,
  VizOrientation,
} from '@grafana/schema';
import { QUERIES } from '../queries';
import { PANEL_HEIGHTS } from '../../constants';

export function getLanguagesScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet
): EmbeddedScene {
  const totalLanguagesQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalLanguages',
        expr: QUERIES.totalLanguages,
        instant: true,
      },
    ],
  });

  const toolDecisionsByLanguageQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByLanguage',
        expr: QUERIES.toolDecisionsByLanguage,
        legendFormat: '{{language}}',
        instant: true,
      },
    ],
  });

  const toolDecisionsByLanguageOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByLanguageOverTime',
        expr: QUERIES.toolDecisionsByLanguageOverTime,
        legendFormat: '{{language}}',
      },
    ],
  });

  const languageAcceptanceRateQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'LanguageAcceptanceRate',
        expr: QUERIES.languageAcceptanceRate,
        legendFormat: '{{language}}',
        instant: true,
      },
    ],
  });

  const toolDecisionsByLanguageAndMemberQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByLanguageAndMember',
        expr: QUERIES.toolDecisionsByLanguageAndMember,
        legendFormat: '{{language}} - {{user_email}}',
        instant: true,
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
      new SceneRefreshPicker({ intervals: ['30s', '1m', '5m', '15m', '30m'] }),
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
                .setTitle('Languages Used')
                .setUnit('short')
                .setData(totalLanguagesQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.piechart()
                .setTitle('Edits by Language')
                .setData(toolDecisionsByLanguageQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
          ],
        }),
        // Row 2: Language trends
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '60%',
              body: PanelBuilders.timeseries()
                .setTitle('Language Usage Over Time')
                .setUnit('short')
                .setData(toolDecisionsByLanguageOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
                .build(),
            }),
            new SceneFlexItem({
              width: '40%',
              body: PanelBuilders.bargauge()
                .setTitle('Acceptance Rate by Language')
                .setUnit('percent')
                .setData(languageAcceptanceRateQuery)
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
        // Row 3: Language by member table
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.TABLE,
          children: [
            new SceneFlexItem({
              body: PanelBuilders.table()
                .setTitle('Language Usage by Team Member')
                .setData(toolDecisionsByLanguageAndMemberQuery)
                .setOverrides((b) =>
                  b
                    .matchFieldsWithName('user_email')
                    .overrideDisplayName('Team Member')
                )
                .build(),
            }),
          ],
        }),
      ],
    }),
  });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npx tsc --noEmit src/scenes/pages/LanguagesScene.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/scenes/pages/LanguagesScene.ts
git commit -m "feat: add Languages scene with language distribution and acceptance rates"
```

---

### Task 5: Create Environment Scene

**Files:**
- Create: `src/scenes/pages/EnvironmentScene.ts`

- [ ] **Step 1: Create the Environment scene file**

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
import { LegendDisplayMode, StackingMode } from '@grafana/schema';
import { QUERIES } from '../queries';
import { PANEL_HEIGHTS } from '../../constants';

export function getEnvironmentScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet
): EmbeddedScene {
  const usageByOsTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'UsageByOsType',
        expr: QUERIES.usageByOsType,
        legendFormat: '{{os_type}}',
        instant: true,
      },
    ],
  });

  const usageByHostArchQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'UsageByHostArch',
        expr: QUERIES.usageByHostArch,
        legendFormat: '{{host_arch}}',
        instant: true,
      },
    ],
  });

  const usageByTerminalTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'UsageByTerminalType',
        expr: QUERIES.usageByTerminalType,
        legendFormat: '{{terminal_type}}',
        instant: true,
      },
    ],
  });

  const usageByServiceVersionQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'UsageByServiceVersion',
        expr: QUERIES.usageByServiceVersion,
        legendFormat: '{{service_version}}',
        instant: true,
      },
    ],
  });

  const costByTerminalTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByTerminalType',
        expr: QUERIES.costByTerminalType,
        legendFormat: '{{terminal_type}}',
        instant: true,
      },
    ],
  });

  const costByOsTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByOsType',
        expr: QUERIES.costByOsType,
        legendFormat: '{{os_type}}',
        instant: true,
      },
    ],
  });

  const versionAdoptionOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'VersionAdoptionOverTime',
        expr: QUERIES.versionAdoptionOverTime,
        legendFormat: '{{service_version}}',
      },
    ],
  });

  const usageByDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'UsageByDevice',
        expr: QUERIES.usageByDevice,
        legendFormat: '{{device}}',
        instant: true,
      },
    ],
  });

  const costByDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByDevice',
        expr: QUERIES.costByDevice,
        legendFormat: '{{device}}',
        instant: true,
      },
    ],
  });

  const terminalTypeOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TerminalTypeOverTime',
        expr: QUERIES.terminalTypeOverTime,
        legendFormat: '{{terminal_type}}',
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
      new SceneRefreshPicker({ intervals: ['30s', '1m', '5m', '15m', '30m'] }),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        // Row 1: Distribution pies
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.MEDIUM,
          children: [
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('OS Distribution')
                .setData(usageByOsTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Architecture')
                .setData(usageByHostArchQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('IDE / Terminal')
                .setData(usageByTerminalTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Claude Code Version')
                .setData(usageByServiceVersionQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
          ],
        }),
        // Row 2: Device breakdown (requires OTEL_RESOURCE_ATTRIBUTES="device=...")
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Usage by Device')
                .setData(usageByDeviceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Cost by Device')
                .setUnit('currencyUSD')
                .setData(costByDeviceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never)
                .build(),
            }),
          ],
        }),
        // Row 3: Cost breakdown by environment
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Cost by IDE / Terminal')
                .setUnit('currencyUSD')
                .setData(costByTerminalTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Cost by OS')
                .setUnit('currencyUSD')
                .setData(costByOsTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
          ],
        }),
        // Row 3: Trends over time
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.timeseries()
                .setTitle('IDE / Terminal Usage Over Time')
                .setUnit('short')
                .setData(terminalTypeOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 20)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.timeseries()
                .setTitle('Version Adoption Over Time')
                .setUnit('short')
                .setData(versionAdoptionOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 20)
                .build(),
            }),
          ],
        }),
      ],
    }),
  });
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npx tsc --noEmit src/scenes/pages/EnvironmentScene.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/scenes/pages/EnvironmentScene.ts
git commit -m "feat: add Environment scene with OS, IDE, architecture, and version panels"
```

---

### Task 6: Enhance Tools Scene with Language and Decision Source

**Files:**
- Modify: `src/scenes/pages/ToolsScene.ts`

- [ ] **Step 1: Add new imports and queries for decision source and language**

Add `StackingMode` to the `@grafana/schema` import if not already present.

Add these query runners after the existing ones in `getToolsScene()`:

```typescript
  const toolDecisionsBySourceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsBySource',
        expr: QUERIES.toolDecisionsBySource,
        legendFormat: '{{source}}',
        instant: true,
      },
    ],
  });

  const toolDecisionsBySourceOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsBySourceOverTime',
        expr: QUERIES.toolDecisionsBySourceOverTime,
        legendFormat: '{{source}}',
      },
    ],
  });

  const toolDecisionsByLanguageQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByLanguage',
        expr: QUERIES.toolDecisionsByLanguage,
        legendFormat: '{{language}}',
        instant: true,
      },
    ],
  });
```

- [ ] **Step 2: Add new rows to the scene body**

After the existing Row 2, add two new rows:

```typescript
        // Row 3: Decision source breakdown
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '40%',
              body: PanelBuilders.piechart()
                .setTitle('Decisions by Source')
                .setData(toolDecisionsBySourceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
            new SceneFlexItem({
              width: '60%',
              body: PanelBuilders.timeseries()
                .setTitle('Decision Source Over Time')
                .setUnit('short')
                .setData(toolDecisionsBySourceOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
                .build(),
            }),
          ],
        }),
        // Row 4: Language breakdown (on tool decisions)
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.MEDIUM,
          children: [
            new SceneFlexItem({
              body: PanelBuilders.piechart()
                .setTitle('Tool Decisions by Language')
                .setData(toolDecisionsByLanguageQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
          ],
        }),
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npx tsc --noEmit src/scenes/pages/ToolsScene.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/scenes/pages/ToolsScene.ts
git commit -m "feat: enhance Tools scene with decision source and language breakdown"
```

---

### Task 7: Update Overview Scene (Remove Environment Row, Add Active Time Breakdown)

**Files:**
- Modify: `src/scenes/pages/OverviewScene.ts`

- [ ] **Step 1: Remove the environment row (Row 4)**

Remove the entire Row 4 block (the `SceneFlexLayout` containing the 4 environment pie charts: OS Type, Architecture, Terminal, Claude Code Version) and all 4 associated query runners (`usageByOsTypeQuery`, `usageByHostArchQuery`, `usageByTerminalTypeQuery`, `usageByServiceVersionQuery`).

- [ ] **Step 2: Replace active time chart with type breakdown**

Replace the `activeTimeOverTimeQuery` with a query that breaks down by type:

```typescript
  const activeTimeByTypeOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ActiveTimeByTypeOverTime',
        expr: QUERIES.activeTimeByTypeOverTime,
        legendFormat: '{{type}}',
      },
    ],
  });
```

Update the "Active Time Over Time" panel in Row 3 to use `activeTimeByTypeOverTimeQuery` instead of `activeTimeOverTimeQuery`, and add stacking:

```typescript
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.timeseries()
                .setTitle('Active Time Over Time')
                .setUnit('s')
                .setData(activeTimeByTypeOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 20)
                .build(),
            }),
```

Make sure `StackingMode` is imported from `@grafana/schema`.

- [ ] **Step 3: Verify the file compiles**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npx tsc --noEmit src/scenes/pages/OverviewScene.ts 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/scenes/pages/OverviewScene.ts
git commit -m "feat: update Overview - move environment to dedicated tab, add active time type breakdown"
```

---

### Task 8: Register New Tabs in SceneAppPage

**Files:**
- Modify: `src/components/scenes/SceneAppPage.tsx`

- [ ] **Step 1: Add imports for new scenes**

```typescript
import { getLanguagesScene } from '../../scenes/pages/LanguagesScene';
import { getEnvironmentScene } from '../../scenes/pages/EnvironmentScene';
```

- [ ] **Step 2: Add new tabs after Productivity tab**

```typescript
          new SceneAppPage({
            title: 'Languages',
            url: prefixRoute(ROUTES.Languages),
            routePath: `/${ROUTES.Languages}`,
            getScene: () => getLanguagesScene(timeRange, variables),
          }),
          new SceneAppPage({
            title: 'Environment',
            url: prefixRoute(ROUTES.Environment),
            routePath: `/${ROUTES.Environment}`,
            getScene: () => getEnvironmentScene(timeRange, variables),
          }),
```

- [ ] **Step 3: Verify the file compiles**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npx tsc --noEmit src/components/scenes/SceneAppPage.tsx 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/scenes/SceneAppPage.tsx
git commit -m "feat: register Languages and Environment tabs in app navigation"
```

---

### Task 9: Full Build Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full TypeScript type check**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npx tsc --noEmit 2>&1 | head -40`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npm run build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Run lint if available**

Run: `cd /Users/keanu/code/claudestats-app-grafana && npm run lint 2>&1 | tail -20`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build issues from enhanced metrics implementation"
```

---

### Task 10: Update AGENTS.md Documentation

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the Dashboard Scenes section**

Add entries for the two new tabs:

```markdown
6. **Languages** - Programming language distribution from code edits, language usage trends over time, acceptance rate by language, language usage by team member
7. **Environment** - OS distribution, architecture, IDE/terminal usage, Claude Code version adoption, cost breakdown by IDE and OS, usage trends over time
```

- [ ] **Step 2: Update the Team Filtering section**

Add:
```markdown
- QueryVariable for filtering by `terminal_type` (IDE/Terminal: vscode, cursor, iTerm, tmux, etc.)
- QueryVariable for filtering by `os_type` (darwin, linux, windows)
- QueryVariable for filtering by `device` (custom device name via OTEL_RESOURCE_ATTRIBUTES)
```

- [ ] **Step 3: Update the Labels table**

Add:
```markdown
- `language` - Programming language of edited file (e.g., TypeScript, Python, JavaScript, Markdown)
- `source` - How tool decision was made (config, hook, user_permanent, user_temporary, user_abort, user_reject)
- `device` - Custom device name (set via `OTEL_RESOURCE_ATTRIBUTES="device=my-macbook"`)
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md with new Languages, Environment tabs and filter variables"
```
