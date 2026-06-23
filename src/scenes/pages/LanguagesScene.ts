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
import {
  BigValueGraphMode,
  LegendDisplayMode,
  StackingMode,
  BarGaugeDisplayMode,
  BarGaugeValueMode,
  VizOrientation,
} from '@grafana/schema';
import { QUERIES } from '../queries';
import { PANEL_HEIGHTS } from '../../constants';

export function getLanguagesScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet
): EmbeddedScene {
  // --- Row 1: Stats ---

  const totalLanguagesQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'TotalLanguages', expr: QUERIES.totalLanguages }],
  });

  const totalLanguageEditsQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'TotalLanguageEdits', expr: QUERIES.totalLanguageEdits }],
  });

  const overallAcceptanceRateQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'OverallAcceptanceRate', expr: QUERIES.overallLanguageAcceptanceRate }],
  });

  // --- Row 2: Distribution ---

  const toolDecisionsByLanguageQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      { refId: 'ToolDecisionsByLanguage', expr: QUERIES.toolDecisionsByLanguage, legendFormat: '{{language}}' },
    ],
  });

  const languageAcceptanceRateQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      { refId: 'LanguageAcceptanceRate', expr: QUERIES.languageAcceptanceRate, legendFormat: '{{language}}' },
    ],
  });

  const toolDecisionsByToolAndLanguageQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByToolAndLanguage',
        expr: QUERIES.toolDecisionsByToolAndLanguage,
        legendFormat: '{{language}} / {{tool_name}}',
        instant: true,
      },
    ],
  });

  // --- Row 3: Trends ---

  const toolDecisionsByLanguageOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByLanguageOverTime',
        expr: QUERIES.toolDecisionsByLanguageOverTime,
        legendFormat: '{{language}}',
      },
    ],
  });

  // --- Row 4: Detail Tables ---

  const toolDecisionsByLanguageAndMemberQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByLanguageAndMember',
        expr: QUERIES.toolDecisionsByLanguageAndMember,
        legendFormat: '{{language}} - {{user_email}}',
        instant: true,
        format: 'table',
      },
    ],
  });

  const toolDecisionsByLanguageAndDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByLanguageAndDevice',
        expr: QUERIES.toolDecisionsByLanguageAndDevice,
        legendFormat: '{{language}} - {{device}}',
        instant: true,
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
          height: PANEL_HEIGHTS.STAT,
          children: [
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Languages Used')
                .setUnit('short')
                .setData(totalLanguagesQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Tool Decisions')
                .setUnit('short')
                .setData(totalLanguageEditsQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.stat()
                .setTitle('Acceptance Rate')
                .setUnit('percent')
                .setData(overallAcceptanceRateQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
          ],
        }),
        // Row 2: Distribution
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '40%',
              body: PanelBuilders.piechart()
                .setTitle('Tool Decisions by Language')
                .setData(toolDecisionsByLanguageQuery)
                .setOption('legend', {
                  displayMode: LegendDisplayMode.Table,
                  placement: 'right',
                  values: ['value', 'percent'] as never,
                })
                .build(),
            }),
            new SceneFlexItem({
              width: '30%',
              body: PanelBuilders.bargauge()
                .setTitle('Acceptance by Language')
                .setUnit('percent')
                .setData(languageAcceptanceRateQuery)
                .setOption('displayMode', BarGaugeDisplayMode.Gradient)
                .setOption('orientation', VizOrientation.Horizontal)
                .setOption('valueMode', BarGaugeValueMode.Text)
                .setOption('showUnfilled', true)
                .setOption('minVizWidth', 150)
                .setOption('minVizHeight', 25)
                .setDisplayName('${__series.name}')
                .build(),
            }),
            new SceneFlexItem({
              width: '30%',
              body: PanelBuilders.bargauge()
                .setTitle('By Language and Tool')
                .setUnit('short')
                .setData(toolDecisionsByToolAndLanguageQuery)
                .setOption('displayMode', BarGaugeDisplayMode.Gradient)
                .setOption('orientation', VizOrientation.Horizontal)
                .setOption('valueMode', BarGaugeValueMode.Text)
                .setOption('showUnfilled', true)
                .setOption('minVizWidth', 150)
                .setOption('minVizHeight', 25)
                .setDisplayName('${__series.name}')
                .build(),
            }),
          ],
        }),
        // Row 3: Trends
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              body: PanelBuilders.timeseries()
                .setTitle('Language Usage Over Time')
                .setUnit('short')
                .setData(toolDecisionsByLanguageOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
                .build(),
            }),
          ],
        }),
        // Row 4: Detail Tables
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.TABLE,
          children: [
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.table()
                .setTitle('Tool Decisions by Team Member')
                .setData(toolDecisionsByLanguageAndMemberQuery)
                .setOption('sortBy', [{ displayName: 'Value', desc: true }])
                .setOverrides((b) =>
                  b
                    .matchFieldsWithName('language')
                    .overrideDisplayName('Language')
                    .matchFieldsWithName('user_email')
                    .overrideDisplayName('Team Member')
                )
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.table()
                .setTitle('Tool Decisions by Device')
                .setData(toolDecisionsByLanguageAndDeviceQuery)
                .setOption('sortBy', [{ displayName: 'Value', desc: true }])
                .setOverrides((b) =>
                  b
                    .matchFieldsWithName('language')
                    .overrideDisplayName('Language')
                    .matchFieldsWithName('device')
                    .overrideDisplayName('Device')
                )
                .build(),
            }),
          ],
        }),
      ],
    }),
  });
}
