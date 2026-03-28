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
  const totalLanguagesQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TotalLanguages',
        expr: QUERIES.totalLanguages,
        instant: true,
      },
    ],
  });

  const toolDecisionsByLanguageQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByLanguage',
        expr: QUERIES.toolDecisionsByLanguage,
        legendFormat: '{{language}}',
        instant: true,
      },
    ],
  });

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

  const languageAcceptanceRateQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'LanguageAcceptanceRate',
        expr: QUERIES.languageAcceptanceRate,
        legendFormat: '{{language}}',
        instant: true,
      },
    ],
  });

  const toolDecisionsByLanguageAndMemberQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'ToolDecisionsByLanguageAndMember',
        expr: QUERIES.toolDecisionsByLanguageAndMember,
        legendFormat: '{{language}} - {{user_email}}',
        instant: true,
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
                .setTitle('Languages Used')
                .setUnit('short')
                .setData(totalLanguagesQuery)
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: PanelBuilders.piechart()
                .setTitle('Edits by Language')
                .setData(toolDecisionsByLanguageQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
          ],
        }),
        // Row 2: Language trends
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '60%',
              body: PanelBuilders.timeseries()
                .setTitle('Language Usage Over Time')
                .setUnit('short')
                .setData(toolDecisionsByLanguageOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 30)
                .build(),
            }),
            new SceneFlexItem({
              width: '40%',
              body: PanelBuilders.bargauge()
                .setTitle('Acceptance Rate by Language')
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
          ],
        }),
        // Row 3: Language by member table
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.TABLE,
          children: [
            new SceneFlexItem({
              body: PanelBuilders.table()
                .setTitle('Language Usage by Team Member')
                .setData(toolDecisionsByLanguageAndMemberQuery)
                .setOverrides((b) =>
                  b
                    .matchFieldsWithName('user_email')
                    .overrideDisplayName('Team Member')
                )
                .build(),
            }),
          ],
        }),
      ],
    }),
  });
}
