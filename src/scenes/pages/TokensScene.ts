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
import { barPanel, piePanel, statPanel, timeseriesPanel } from '../viz/panels';
import { QUERIES } from '../queries';
import { PANEL_HEIGHTS } from '../../constants';

export function getTokensScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet
): EmbeddedScene {
  const totalTokensQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalTokens',
        expr: QUERIES.totalTokens,
      },
    ],
  });

  const inputTokensQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'InputTokens',
        expr: QUERIES.inputTokens,
      },
    ],
  });

  const outputTokensQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'OutputTokens',
        expr: QUERIES.outputTokens,
      },
    ],
  });

  const cacheReadTokensQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CacheReadTokens',
        expr: QUERIES.cacheReadTokens,
      },
    ],
  });

  const tokensByTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TokensByType',
        expr: QUERIES.tokensByType,
        legendFormat: '{{type}}',
      },
    ],
  });

  const tokensOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TokensOverTime',
        expr: QUERIES.tokensOverTime,
        legendFormat: '{{type}}',
      },
    ],
  });

  const tokensByModelQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TokensByModel',
        expr: QUERIES.tokensByModel,
        legendFormat: '{{provider}}',
      },
    ],
  });

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
        // Row 1: Token stats by type
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.STAT,
          children: [
            new SceneFlexItem({
              body: statPanel({ title: 'Total Tokens', quantity: 'tokens', data: totalTokensQuery })
                .setOption('graphMode', BigValueGraphMode.Area)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Input Tokens',
                quantity: 'tokens',
                data: inputTokensQuery,
                color: { fixedColor: 'blue', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Output Tokens',
                quantity: 'tokens',
                data: outputTokensQuery,
                color: { fixedColor: 'green', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Cache Read',
                quantity: 'tokens',
                data: cacheReadTokensQuery,
                color: { fixedColor: 'purple', mode: 'fixed' },
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
          ],
        }),
        // Row 2: Distribution and over time
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '35%',
              // Stays a pie: token `type` is a bounded four-value set and the
              // question is part-to-whole.
              body: piePanel({
                title: 'Token Distribution by Type',
                quantity: 'tokens',
                data: tokensByTypeQuery,
              }).build(),
            }),
            new SceneFlexItem({
              width: '65%',
              // Not clustered: grouped by the bounded token `type`.
              body: timeseriesPanel({
                title: 'Token Usage Over Time',
                quantity: 'tokens',
                data: tokensOverTimeQuery,
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
          ],
        }),
        // Row 3: By model and by member
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              // Stays a pie: `provider` is the bounded CAG-3 family set.
              body: piePanel({ title: 'Tokens by Provider', quantity: 'tokens', data: tokensByModelQuery }).build(),
            }),
            new SceneFlexItem({
              width: '50%',
              // Ranked comparison over an unbounded dimension: bar, clustered.
              body: barPanel({
                title: 'Claude Tokens by Device',
                quantity: 'tokens',
                data: tokensByDeviceQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
          ],
        }),
      ],
    }),
  });
}
