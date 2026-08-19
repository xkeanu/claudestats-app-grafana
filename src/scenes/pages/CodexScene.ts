import {
  EmbeddedScene,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
  SceneDataTransformer,
} from '@grafana/scenes';
import { BigValueGraphMode, BigValueTextMode, LineInterpolation, StackingMode } from '@grafana/schema';
import { LABELS, PANEL_HEIGHTS } from '../../constants';
import { barPanel, statPanel, timeseriesPanel } from '../viz/panels';
import { QUERIES } from '../queries';
import { makeCostTransformation } from '../../pricing/costTransformation';

/**
 * Codex emits no cost metric, so cost is derived: tokens x a published price
 * table, applied client-side. Every figure downstream of this is an ESTIMATE
 * and is labelled as one — see AGENTS.md, "Estimated Codex cost".
 */
const ESTIMATE_NOTE =
  'ESTIMATE — Codex emits no cost metric. Derived from token counts times a published price table, so it will not match an invoice.';

export function getCodexScene(timeRange: SceneTimeRange, variables: SceneVariableSet): EmbeddedScene {
  const totalTokensQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'CodexTotalTokens', expr: QUERIES.codexTotalTokens }],
  });

  const apiRequestsQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'CodexApiRequests', expr: QUERIES.codexApiRequests }],
  });

  const turnDurationQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'CodexTurnDuration', expr: QUERIES.codexTurnDuration }],
  });

  const approvalRateQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'CodexApprovalRate', expr: QUERIES.codexApprovalRate }],
  });

  const toolSuccessRateQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'CodexToolSuccessRate', expr: QUERIES.codexToolSuccessRate }],
  });

  const turnCountQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'CodexTurnCount', expr: QUERIES.codexTurnCount }],
  });

  const tokensByTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'CodexTokensByType', expr: QUERIES.codexTokensByType, legendFormat: `{{${LABELS.CODEX_TOKEN_TYPE}}}` }],
  });

  const toolCallsByToolQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'CodexToolCallsByTool', expr: QUERIES.codexToolCallsByTool, legendFormat: `{{${LABELS.CODEX_TOOL}}}` }],
  });

  const apiAndSseQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      { refId: 'CodexApiRequestsOverTime', expr: QUERIES.codexApiRequestsOverTime, legendFormat: 'API Requests' },
      { refId: 'CodexSseEventsOverTime', expr: QUERIES.codexSseEventsOverTime, legendFormat: 'SSE Events' },
    ],
  });

  const tokensByModelAndTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'CodexTokensByModelAndType', expr: QUERIES.codexTokensByModelAndType }],
  });

  // One query runner, three views of it. The price table behind them is
  // memoised, so this is one resolution and — with live refresh on — one fetch.
  const estimatedCostData = new SceneDataTransformer({
    $data: tokensByModelAndTypeQuery,
    transformations: [makeCostTransformation('cost')],
  });

  const unpricedTokensData = new SceneDataTransformer({
    $data: tokensByModelAndTypeQuery,
    transformations: [makeCostTransformation('unpriced')],
  });

  const priceProvenanceData = new SceneDataTransformer({
    $data: tokensByModelAndTypeQuery,
    transformations: [makeCostTransformation('provenance')],
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
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.STAT,
          children: [
            new SceneFlexItem({
              body: statPanel({ title: 'Codex Total Tokens', quantity: 'tokens', data: totalTokensQuery })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({ title: 'Codex API Requests', quantity: 'count', data: apiRequestsQuery })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({ title: 'Avg Codex Turn Duration', quantity: 'durationMs', data: turnDurationQuery })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Guardian Approval Rate',
                description: 'Codex auto-review (guardian) decisions: approved / all reviews. Only emitted by the desktop/app-server with auto-review enabled.',
                quantity: 'rate',
                data: approvalRateQuery,
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Tool Success Rate',
                description: 'Successful Codex tool calls (success="true") / all tool calls.',
                quantity: 'rate',
                data: toolSuccessRateQuery,
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Conversation Turns',
                description: 'Codex conversation turns (one per user turn). Distinct from sessions.',
                quantity: 'count',
                data: turnCountQuery,
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
          ],
        }),
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.STAT,
          children: [
            new SceneFlexItem({
              body: statPanel({
                title: 'Estimated Codex Cost',
                description: `${ESTIMATE_NOTE} Cached input is charged at the cache-read rate; models absent from the price table contribute nothing and are counted under Unpriced Tokens.`,
                quantity: 'cost',
                data: estimatedCostData,
                // Fixed purple rather than the thresholds colouring the measured
                // Claude cost stats use, so an estimate never reads as measured.
                color: { mode: 'fixed', fixedColor: 'purple' },
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({
                title: 'Unpriced Tokens',
                description:
                  'Billable Codex tokens belonging to models the price table cannot price (for example codex-auto-review, which is not an OpenAI catalogue model). These contribute nothing to the estimate, so a non-zero figure here means the estimate is understated.',
                quantity: 'tokens',
                data: unpricedTokensData,
                color: { mode: 'fixed', fixedColor: 'text' },
              })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              // No quantity: this stat displays a provenance string, not a
              // number, so a unit would be meaningless.
              body: statPanel({
                title: 'Price Table',
                description:
                  'Which price table produced the estimate, and its as-of date. "Refresh failed" means live refresh is enabled but the feed could not be used, so the bundled table was substituted.',
                data: priceProvenanceData,
                color: { mode: 'fixed', fixedColor: 'text' },
              })
                .setOption('graphMode', BigValueGraphMode.None)
                // A stat panel reduces numeric fields only by default, so a
                // text-valued field renders as "No data" without this.
                .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/.*/', values: false })
                .setOption('textMode', BigValueTextMode.Value)
                .build(),
            }),
          ],
        }),
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              // Not clustered: grouped by the bounded Codex `token_type`.
              body: timeseriesPanel({
                title: 'Codex Tokens by Token Type',
                quantity: 'tokens',
                data: tokensByTypeQuery,
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              // `tool` takes the contract's default bar limit.
              body: barPanel({
                title: 'Codex Tool Calls by Tool',
                quantity: 'count',
                data: toolCallsByToolQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
          ],
        }),
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '100%',
              // Not clustered: exactly two named series.
              body: timeseriesPanel({
                title: 'Codex API Requests and SSE Events',
                quantity: 'count',
                data: apiAndSseQuery,
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
