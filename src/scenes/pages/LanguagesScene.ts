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
import { BigValueGraphMode, StackingMode } from '@grafana/schema';
import { QUERIES } from '../queries';
import { barPanel, statPanel, tablePanel, timeseriesPanel } from '../viz/panels';
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
              body: statPanel({ title: 'Languages Used', quantity: 'count', data: totalLanguagesQuery })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({ title: 'Tool Decisions', quantity: 'count', data: totalLanguageEditsQuery })
                .setOption('graphMode', BigValueGraphMode.None)
                .build(),
            }),
            new SceneFlexItem({
              body: statPanel({ title: 'Acceptance Rate', quantity: 'rate', data: overallAcceptanceRateQuery })
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
              // Ranked comparison over an unbounded dimension: bar, clustered.
              body: barPanel({
                title: 'Tool Decisions by Language',
                quantity: 'count',
                data: toolDecisionsByLanguageQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
            new SceneFlexItem({
              width: '30%',
              // Ratio mode: summing acceptance percentages into a residual
              // would produce a number that means nothing, so the tail is
              // dropped rather than bucketed (REQ-014).
              //
              // Known limitation, recorded as a follow-up rather than fixed
              // here: ranking a ratio by its own value favours low-volume
              // outliers — a language with one accepted edit ranks at 100%.
              // Adding a minimum-volume floor would change the number the
              // panel reports, which this ticket's non-goals exclude.
              body: barPanel({
                title: 'Acceptance by Language',
                quantity: 'rate',
                data: languageAcceptanceRateQuery,
                cluster: { mode: 'ratio' },
              }).build(),
            }),
            new SceneFlexItem({
              width: '30%',
              // The fastest-growing dimension on the app: the language x tool
              // cross-product. Additive clustering at the bar limit.
              body: barPanel({
                title: 'By Language and Tool',
                quantity: 'count',
                data: toolDecisionsByToolAndLanguageQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
          ],
        }),
        // Row 3: Trends
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              // Clustered: `language` grows without bound.
              body: timeseriesPanel({
                title: 'Language Usage Over Time',
                quantity: 'count',
                data: toolDecisionsByLanguageOverTimeQuery,
                cluster: { mode: 'additive' },
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
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
              // Tables are exempt from clustering (REQ-015).
              body: tablePanel({
                title: 'Tool Decisions by Team Member',
                data: toolDecisionsByLanguageAndMemberQuery,
              })
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
              // Tables are exempt from clustering (REQ-015).
              body: tablePanel({
                title: 'Tool Decisions by Device',
                data: toolDecisionsByLanguageAndDeviceQuery,
              })
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
