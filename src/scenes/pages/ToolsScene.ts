import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
  SceneControlsSpacer,
  SceneTimePicker,
  SceneRefreshPicker,
} from '@grafana/scenes';
import { BigValueGraphMode, LineInterpolation, StackingMode } from '@grafana/schema';
import { QUERIES } from '../queries';
import { barPanel, piePanel, statPanel, timeseriesPanel } from '../viz/panels';
import { PANEL_HEIGHTS } from '../../constants';

export function getToolsScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet
): EmbeddedScene {
  const toolDecisionsQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisions',
        expr: QUERIES.toolDecisions,
        legendFormat: '{{decision}}',
      },
    ],
  });

  const toolDecisionsByToolQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByTool',
        expr: QUERIES.toolDecisionsByTool,
        legendFormat: '{{tool_name}}',
      },
    ],
  });

  const toolAcceptanceRateQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolAcceptanceRate',
        expr: QUERIES.toolAcceptanceRate,
      },
    ],
  });

  const toolDecisionsOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsOverTime',
        expr: QUERIES.toolDecisionsOverTime,
        legendFormat: '{{decision}}',
      },
    ],
  });

  const toolDecisionsBySourceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsBySource',
        expr: QUERIES.toolDecisionsBySource,
        legendFormat: '{{source}}',
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
              body: statPanel({ title: 'Tool Acceptance Rate', quantity: 'rate', data: toolAcceptanceRateQuery })
                .setOption('graphMode', BigValueGraphMode.None)
                .setThresholds({
                  mode: 'absolute',
                  steps: [
                    { color: 'red', value: 0 },
                    { color: 'yellow', value: 50 },
                    { color: 'green', value: 80 },
                  ],
                } as never)
                .build(),
            }),
            new SceneFlexItem({
              // Stays a pie: `decision` is accept | reject. Both names carry
              // their semantic colour from the palette module, applied by the
              // contract's overrides rather than by palette-classic-by-name.
              body: piePanel({ title: 'Tool Decisions', quantity: 'count', data: toolDecisionsQuery }).build(),
            }),
          ],
        }),
        // Row 2: Tool decisions over time and by tool
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '60%',
              // Not clustered: grouped by the bounded `decision` label.
              body: timeseriesPanel({
                title: 'Tool Decisions Over Time',
                quantity: 'count',
                data: toolDecisionsOverTimeQuery,
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
            new SceneFlexItem({
              width: '40%',
              // `tool_name` will not reach the bar limit today, but it takes
              // the contract's default rather than being special-cased.
              body: barPanel({
                title: 'Usage by Tool',
                quantity: 'count',
                data: toolDecisionsByToolQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
          ],
        }),
        // Row 3: Decision source breakdown
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '40%',
              // Stays a pie: decision `source` is a bounded six-value set.
              body: piePanel({
                title: 'Claude Decisions by Source',
                quantity: 'count',
                data: toolDecisionsBySourceQuery,
              }).build(),
            }),
            new SceneFlexItem({
              width: '60%',
              // Not clustered: grouped by the bounded decision `source`.
              body: timeseriesPanel({
                title: 'Claude Decision Source Over Time',
                quantity: 'count',
                data: toolDecisionsBySourceOverTimeQuery,
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
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
              // Ranked comparison over an unbounded dimension: bar, clustered.
              body: barPanel({
                title: 'Claude Tool Decisions by Language',
                quantity: 'count',
                data: toolDecisionsByLanguageQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
          ],
        }),
      ],
    }),
  });
}
