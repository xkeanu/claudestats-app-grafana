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
import { makeBlendedCostTransformation } from '../../pricing/costTransformation';
import { barPanel, statPanel, timeseriesPanel } from '../viz/panels';

/** Panels that break cost down by a label Codex does not emit cannot meaningfully blend. */
const CLAUDE_ONLY_NOTE =
  'CLAUDE CODE ONLY — Codex does not emit this dimension, so its spend is absent from this panel. See the Codex tab for Codex cost.';
import { PANEL_HEIGHTS } from '../../constants';

export function getOverviewScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet
): EmbeddedScene {
  // Data queries
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

  // Claude's measured cost plus the Codex estimate. Token counts were already
  // dual-tool while cost was Claude-only, so every dollar of Codex spend read
  // as $0 next to a dual-tool token figure.
  const blendedCostData = new SceneDataTransformer({
    $data: totalCostQuery,
    transformations: [makeBlendedCostTransformation()],
  });

  const totalTokensQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalTokens',
        expr: QUERIES.totalTokens,
      },
    ],
  });

  const totalSessionsQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalSessions',
        expr: QUERIES.totalSessions,
      },
    ],
  });

  const activeUsersQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ActiveUsers',
        expr: QUERIES.activeUsers,
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
                title: 'Total Cost *',
                description: `* INCLUDES AN ESTIMATED COMPONENT. Claude cost is measured. Codex emits no cost metric, so its spend is ESTIMATED from token counts times a published price table — see the Codex tab for the estimate, its as-of date and unpriced token volume.`,
                quantity: 'cost',
                data: blendedCostData,
                color: { mode: 'thresholds' },
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({ title: 'Total Tokens', quantity: 'tokens', data: totalTokensQuery })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({ title: 'Sessions / Turns', quantity: 'count', data: totalSessionsQuery })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({ title: 'Claude Active Users', quantity: 'count', data: activeUsersQuery })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
          ],
        }),
        // Row 2: Cost Charts
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '60%',
              // Not clustered: `provider` is the bounded CAG-3 family set, well
              // under the time series limit.
              body: timeseriesPanel({
                title: 'Claude Cost Over Time',
                description: CLAUDE_ONLY_NOTE,
                quantity: 'cost',
                data: costOverTimeQuery,
              })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
            new SceneFlexItem({
              width: '40%',
              // Ranked comparison over an unbounded dimension: bar, clustered.
              body: barPanel({
                title: 'Claude Cost by Device',
                description: CLAUDE_ONLY_NOTE,
                quantity: 'cost',
                data: costByDeviceQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
          ],
        }),
        // Row 3: Token and Session Charts
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              // Not clustered: token `type` is a bounded four-value set.
              body: timeseriesPanel({
                title: 'Token Usage Over Time',
                quantity: 'tokens',
                data: tokensOverTimeQuery,
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              // Not clustered: active time `type` is user | cli.
              body: timeseriesPanel({
                title: 'Claude Active Time Over Time',
                quantity: 'durationSeconds',
                data: activeTimeByTypeOverTimeQuery,
              })
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
