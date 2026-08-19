import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneQueryRunner,
  SceneTimeRange,
  SceneVariableSet,
  PanelBuilders,
  SceneDataTransformer,
  VariableValueSelectors,
  SceneControlsSpacer,
  SceneTimePicker,
  SceneRefreshPicker,
} from '@grafana/scenes';
import { BigValueGraphMode, LegendDisplayMode, LineInterpolation, StackingMode } from '@grafana/schema';
import { QUERIES } from '../queries';
import { PANEL_HEIGHTS } from '../../constants';
import { makeBlendedCostTransformation } from '../../pricing/costTransformation';

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
              body: PanelBuilders.stat()
                .setTitle('Total Cost *')
                .setDescription('* INCLUDES AN ESTIMATED COMPONENT. Claude cost is measured. Codex emits no cost metric, so its spend is ESTIMATED from token counts times a published price table — see the Codex tab for the estimate, its as-of date and unpriced token volume.')
                .setUnit('currencyUSD')
                .setData(blendedCostData)
                .setOption('graphMode', BigValueGraphMode.Area)
                .setColor({ mode: 'thresholds' })
                .build(),
            }),
            new SceneFlexItem({
              width: '70%',
              body: PanelBuilders.piechart()
                .setTitle('Cost by Provider')
                .setDescription(CLAUDE_ONLY_NOTE)
                .setUnit('currencyUSD')
                .setData(costByModelQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .setOption('pieType', 'donut' as never)
                .build(),
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
              body: PanelBuilders.timeseries()
                .setTitle('Cost Over Time by Provider')
                .setDescription(CLAUDE_ONLY_NOTE)
                .setUnit('currencyUSD')
                .setData(costOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.timeseries()
                .setTitle('Cost Over Time by Device')
                .setDescription(CLAUDE_ONLY_NOTE)
                .setUnit('currencyUSD')
                .setData(costOverTimeByDeviceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
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
              body: PanelBuilders.piechart()
                .setTitle('Cost Distribution by Device')
                .setDescription(CLAUDE_ONLY_NOTE)
                .setUnit('currencyUSD')
                .setData(costByDeviceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '60%',
              body: PanelBuilders.table()
                .setTitle('Cost Breakdown by Device')
                .setDescription(CLAUDE_ONLY_NOTE)
                .setData(costTableQuery)
                .setOption('sortBy', [{ displayName: 'Value', desc: true }])
                .setOverrides((b) =>
                  b.matchFieldsWithName('device').overrideDisplayName('Device')
                )
                .build(),
            }),
          ],
        }),
      ],
    }),
  });
}
