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
