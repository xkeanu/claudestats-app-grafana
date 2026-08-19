import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  SceneDataTransformer,
  VariableValueSelectors,
  SceneControlsSpacer,
  SceneTimePicker,
  SceneRefreshPicker,
} from '@grafana/scenes';
import { BigValueGraphMode, LineInterpolation, StackingMode } from '@grafana/schema';
import { QUERIES } from '../queries';
import { PANEL_HEIGHTS } from '../../constants';
import { makeBlendedCostTransformation } from '../../pricing/costTransformation';
import { barPanel, piePanel, statPanel, tablePanel, timeseriesPanel } from '../viz/panels';

/** Panels that break cost down by a label Codex does not emit cannot meaningfully blend. */
const CLAUDE_ONLY_NOTE =
  'CLAUDE CODE ONLY — Codex does not emit this dimension, so its spend is absent from this panel. See the Codex tab for Codex cost.';

export function getCostsScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet
): EmbeddedScene {
  const totalCostQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalCost',
        expr: QUERIES.totalCost,
      },
      {
        refId: 'CodexTokensByModelAndType',
        expr: QUERIES.codexTokensByModelAndType,
      },
    ],
  });

  // Claude's measured cost plus the Codex estimate.
  const blendedCostData = new SceneDataTransformer({
    $data: totalCostQuery,
    transformations: [makeBlendedCostTransformation()],
  });

  const costByModelQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByModel',
        expr: QUERIES.costByModel,
        legendFormat: '{{provider}}',
      },
    ],
  });

  const costOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostOverTime',
        expr: QUERIES.costOverTime,
        legendFormat: '{{provider}}',
      },
    ],
  });

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

  // Table query for detailed breakdown by device
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
          height: PANEL_HEIGHTS.MEDIUM,
          children: [
            new SceneFlexItem({
              width: '30%',
              body: statPanel({
                title: 'Total Cost *',
                description:
                  '* INCLUDES AN ESTIMATED COMPONENT. Claude cost is measured. Codex emits no cost metric, so its spend is ESTIMATED from token counts times a published price table — see the Codex tab for the estimate, its as-of date and unpriced token volume.',
                quantity: 'cost',
                data: blendedCostData,
                color: { mode: 'thresholds' },
              })
                .setOption('graphMode', BigValueGraphMode.Area)
                .build(),
            }),
            new SceneFlexItem({
              width: '70%',
              // Stays a pie: `provider` is the bounded CAG-3 family set, and
              // the question is genuinely part-to-whole.
              body: piePanel({
                title: 'Cost by Provider',
                description: CLAUDE_ONLY_NOTE,
                quantity: 'cost',
                data: costByModelQuery,
              }).build(),
            }),
          ],
        }),
        // Row 2: Time series charts
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              // Not clustered: `provider` is the bounded family set.
              body: timeseriesPanel({
                title: 'Cost Over Time by Provider',
                description: CLAUDE_ONLY_NOTE,
                quantity: 'cost',
                data: costOverTimeQuery,
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              // Clustered: `device` grows with the team.
              body: timeseriesPanel({
                title: 'Cost Over Time by Device',
                description: CLAUDE_ONLY_NOTE,
                quantity: 'cost',
                data: costOverTimeByDeviceQuery,
                cluster: { mode: 'additive' },
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
          ],
        }),
        // Row 3: Pie chart and table
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '40%',
              // Ranked comparison over an unbounded dimension: bar, clustered.
              body: barPanel({
                title: 'Cost Distribution by Device',
                description: CLAUDE_ONLY_NOTE,
                quantity: 'cost',
                data: costByDeviceQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
            new SceneFlexItem({
              width: '60%',
              // Tables are exempt from clustering (REQ-015): per-row detail,
              // including the raw per-model rows, is the point.
              body: tablePanel({
                title: 'Cost Breakdown by Device',
                description: CLAUDE_ONLY_NOTE,
                data: costTableQuery,
              })
                .setOption('sortBy', [{ displayName: 'Value', desc: true }])
                .setOverrides((b) => b.matchFieldsWithName('device').overrideDisplayName('Device'))
                .build(),
            }),
          ],
        }),
      ],
    }),
  });
}
