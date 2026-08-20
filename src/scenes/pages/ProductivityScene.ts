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
import { BigValueGraphMode, LineInterpolation, StackingMode, GraphDrawStyle } from '@grafana/schema';
import { QUERIES } from '../queries';
import { barPanel, piePanel, statPanel, timeseriesPanel } from '../viz/panels';
import { PANEL_HEIGHTS } from '../../constants';

export function getProductivityScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet
): EmbeddedScene {
  const totalLinesOfCodeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalLinesOfCode',
        expr: QUERIES.totalLinesOfCode,
      },
    ],
  });

  const totalCommitsQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalCommits',
        expr: QUERIES.totalCommits,
      },
    ],
  });

  const totalPullRequestsQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalPullRequests',
        expr: QUERIES.totalPullRequests,
      },
    ],
  });

  const totalActiveTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalActiveTime',
        expr: QUERIES.totalActiveTime,
      },
    ],
  });

  const linesOfCodeByTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'LinesOfCodeByType',
        expr: QUERIES.linesOfCodeByType,
        legendFormat: '{{type}}',
      },
    ],
  });

  const linesOfCodeOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'LinesOfCodeOverTime',
        expr: QUERIES.linesOfCodeOverTime,
        legendFormat: '{{type}}',
      },
    ],
  });

  const commitsOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CommitsOverTime',
        expr: QUERIES.commitsOverTime,
        legendFormat: 'Commits',
      },
    ],
  });

  const pullRequestsOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'PullRequestsOverTime',
        expr: QUERIES.pullRequestsOverTime,
        legendFormat: 'Pull Requests',
      },
    ],
  });

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
                title: 'Lines of Code',
                quantity: 'count',
                data: totalLinesOfCodeQuery,
                color: { fixedColor: 'blue', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.Area)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Commits',
                quantity: 'count',
                data: totalCommitsQuery,
                color: { fixedColor: 'green', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.Area)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Pull Requests',
                description: 'Only counts PRs created by Claude Code itself (gh pr create, glab mr create). Manual PRs are not tracked.',
                quantity: 'count',
                data: totalPullRequestsQuery,
                color: { fixedColor: 'purple', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.Area)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Active Time',
                quantity: 'durationSeconds',
                data: totalActiveTimeQuery,
                color: { fixedColor: 'orange', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.Area)
                .build(),
            }),
          ],
        }),
        // Row 2: Lines of code charts
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '35%',
              // Stays a pie: LOC `type` is added | removed, and both names
              // take their semantic colour from the palette module.
              body: piePanel({
                title: 'Lines Added vs Removed',
                quantity: 'count',
                data: linesOfCodeByTypeQuery,
              }).build(),
            }),
            new SceneFlexItem({
              width: '65%',
              // Not clustered: grouped by the bounded LOC `type`.
              body: timeseriesPanel({
                title: 'Lines of Code Over Time',
                quantity: 'count',
                data: linesOfCodeOverTimeQuery,
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
          ],
        }),
        // Row 3: Commits and PRs over time
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.MEDIUM,
          children: [
            new SceneFlexItem({
              width: '50%',
              // Not clustered: a single aggregate series.
              body: timeseriesPanel({ title: 'Commits Over Time', quantity: 'count', data: commitsOverTimeQuery })
                .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              // Not clustered: a single aggregate series.
              body: timeseriesPanel({
                title: 'Pull Requests Over Time',
                description: 'Only counts PRs created by Claude Code itself (gh pr create, glab mr create). Manual PRs are not tracked.',
                quantity: 'count',
                data: pullRequestsOverTimeQuery,
              })
                .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
                .build(),
            }),
          ],
        }),
        // Row 4: Active time by member
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              // Ranked comparison over an unbounded dimension: clustered.
              body: barPanel({
                title: 'Active Time by Device',
                quantity: 'durationSeconds',
                data: activeTimeByDeviceQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
          ],
        }),
      ],
    }),
  });
}
