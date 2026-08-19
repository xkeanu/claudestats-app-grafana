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
import { barPanel, statPanel, timeseriesPanel } from '../viz/panels';
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
        legendFormat: 'Tokens / Session',
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
        legendFormat: 'Active Users',
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
              body: statPanel({
                title: 'Sessions / Turns',
                quantity: 'count',
                data: totalSessionsQuery,
                color: { fixedColor: 'blue', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.Area)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Avg Tokens / Session',
                quantity: 'tokens',
                data: avgTokensPerSessionQuery,
                color: { fixedColor: 'green', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Claude Avg Duration / Session',
                quantity: 'durationSeconds',
                data: avgActiveTimePerSessionQuery,
                color: { fixedColor: 'purple', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Claude Avg Cost / Session',
                quantity: 'cost',
                data: avgCostPerSessionQuery,
                color: { fixedColor: 'orange', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.None)
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
              // Clustered: grouped by `device`, which grows with the team.
              body: timeseriesPanel({
                title: 'Claude Sessions Over Time',
                quantity: 'count',
                data: sessionsOverTimeQuery,
                cluster: { mode: 'additive' },
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
            new SceneFlexItem({
              width: '40%',
              // Not clustered: a single named series.
              body: timeseriesPanel({
                title: 'Session Intensity (Tokens/Session)',
                quantity: 'tokens',
                data: sessionIntensityOverTimeQuery,
              })
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
              // Ranked comparison over an unbounded dimension: bar, clustered.
              body: barPanel({
                title: 'Claude Sessions by Device',
                quantity: 'count',
                data: sessionsByDeviceQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
            new SceneFlexItem({
              width: '30%',
              // The worst cardinality offender on the app: raw `model`, around
              // 34 distinct values. It is deliberately NOT grouped by provider
              // — its Claude metric carries no `model` label, a CAG-3
              // constraint this work must not undo — so clustering is what
              // makes it readable.
              body: barPanel({
                title: 'Sessions by Model',
                quantity: 'count',
                data: sessionsByModelQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
            new SceneFlexItem({
              width: '30%',
              // Not clustered: a single named series.
              body: timeseriesPanel({
                title: 'Claude Active Users Over Time',
                quantity: 'count',
                data: activeUsersOverTimeQuery,
              })
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
