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
  SceneDataTransformer,
} from '@grafana/scenes';
import { BigValueGraphMode, LegendDisplayMode, StackingMode } from '@grafana/schema';
import { QUERIES } from '../queries';
import { PANEL_HEIGHTS, LABELS, METRICS } from '../../constants';
import { createTeamMemberRenameTransformations } from '../../utils/teamMembers';

export function getCostsScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet,
  teamMembers: Record<string, string>
): EmbeddedScene {
  const teamMemberTransforms = createTeamMemberRenameTransformations(teamMembers);

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

  const costByModelQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByModel',
        expr: QUERIES.costByModel,
        legendFormat: '{{model}}',
        instant: true,
      },
    ],
  });

  const costOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostOverTime',
        expr: QUERIES.costOverTime,
        legendFormat: '{{model}}',
      },
    ],
  });

  const costOverTimeByMemberQueryRunner = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostOverTimeByMember',
        expr: QUERIES.costOverTimeByMember,
        legendFormat: '{{user_account_uuid}}',
      },
    ],
  });

  const costOverTimeByMemberQuery = new SceneDataTransformer({
    $data: costOverTimeByMemberQueryRunner,
    transformations: teamMemberTransforms,
  });

  const costByMemberQueryRunner = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByMember',
        expr: QUERIES.costByMember,
        legendFormat: '{{user_account_uuid}}',
        instant: true,
      },
    ],
  });

  const costByMemberQuery = new SceneDataTransformer({
    $data: costByMemberQueryRunner,
    transformations: teamMemberTransforms,
  });

  // Table query for detailed breakdown
  const costTableQueryRunner = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostTable',
        expr: `sum by (${LABELS.USER_ACCOUNT_UUID}, ${LABELS.MODEL}) (${METRICS.COST_USAGE}{${LABELS.USER_ACCOUNT_UUID}=~"$member", ${LABELS.MODEL}=~"$model"})`,
        instant: true,
        format: 'table',
      },
    ],
  });

  const costTableQuery = new SceneDataTransformer({
    $data: costTableQueryRunner,
    transformations: teamMemberTransforms,
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
                .setTitle('Total Cost')
                .setUnit('currencyUSD')
                .setData(totalCostQuery)
                .setOption('graphMode', BigValueGraphMode.Area)
                .setColor({ mode: 'thresholds' })
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.piechart()
                .setTitle('Cost by Model')
                .setUnit('currencyUSD')
                .setData(costByModelQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
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
                .setTitle('Cost Over Time by Model')
                .setUnit('currencyUSD')
                .setData(costOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.timeseries()
                .setTitle('Cost Over Time by Team Member')
                .setUnit('currencyUSD')
                .setData(costOverTimeByMemberQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
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
                .setTitle('Cost Distribution by Member')
                .setUnit('currencyUSD')
                .setData(costByMemberQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '60%',
              body: PanelBuilders.table()
                .setTitle('Cost Breakdown')
                .setData(costTableQuery)
                .setOption('sortBy', [{ displayName: 'Value', desc: true }])
                .build(),
            }),
          ],
        }),
      ],
    }),
  });
}
