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
  PanelBuilders,
} from '@grafana/scenes';
import { BigValueGraphMode, LegendDisplayMode, LineInterpolation, StackingMode } from '@grafana/schema';
import { LABELS, PANEL_HEIGHTS } from '../../constants';
import { QUERIES } from '../queries';

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
              body: PanelBuilders.stat()
                .setTitle('Codex Total Tokens')
                .setUnit('short')
                .setData(totalTokensQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Codex API Requests')
                .setUnit('short')
                .setData(apiRequestsQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Avg Codex Turn Duration')
                .setUnit('ms')
                .setData(turnDurationQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Guardian Approval Rate')
                .setDescription('Codex auto-review (guardian) decisions: approved / all reviews. Only emitted by the desktop/app-server with auto-review enabled.')
                .setUnit('percent')
                .setData(approvalRateQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Tool Success Rate')
                .setDescription('Successful Codex tool calls (success="true") / all tool calls.')
                .setUnit('percent')
                .setData(toolSuccessRateQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Conversation Turns')
                .setDescription('Codex conversation turns (one per user turn). Distinct from sessions.')
                .setUnit('short')
                .setData(turnCountQuery)
                .setOption('graphMode', BigValueGraphMode.None)
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
              body: PanelBuilders.timeseries()
                .setTitle('Codex Tokens by Token Type')
                .setUnit('short')
                .setData(tokensByTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
                .setCustomFieldConfig('lineInterpolation', LineInterpolation.Smooth)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.bargauge()
                .setTitle('Codex Tool Calls by Tool')
                .setUnit('short')
                .setData(toolCallsByToolQuery)
                .setOption('orientation', 'horizontal' as never)
                .setOption('displayMode', 'gradient' as never)
                .setOption('showUnfilled', true)
                .setDisplayName('${__series.name}')
                .build(),
            }),
          ],
        }),
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '100%',
              body: PanelBuilders.timeseries()
                .setTitle('Codex API Requests and SSE Events')
                .setUnit('short')
                .setData(apiAndSseQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
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
