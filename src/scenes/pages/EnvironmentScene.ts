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
import { LegendDisplayMode, StackingMode } from '@grafana/schema';
import { QUERIES } from '../queries';
import { LABELS, PANEL_HEIGHTS } from '../../constants';

export function getEnvironmentScene(
  timeRange: SceneTimeRange,
  variables: SceneVariableSet
): EmbeddedScene {
  const usageByOsTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'UsageByOsType',
        expr: QUERIES.usageByOsType,
        legendFormat: '{{os_type}}',
      },
    ],
  });

  const usageByHostArchQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'UsageByHostArch',
        expr: QUERIES.usageByHostArch,
        legendFormat: '{{host_arch}}',
      },
    ],
  });

  const usageByTerminalTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'UsageByTerminalType',
        expr: QUERIES.usageByTerminalType,
        legendFormat: '{{terminal_type}}',
      },
    ],
  });

  const usageByServiceVersionQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'UsageByServiceVersion',
        expr: QUERIES.usageByServiceVersion,
        legendFormat: '{{service_version}}',
      },
    ],
  });

  const costByTerminalTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByTerminalType',
        expr: QUERIES.costByTerminalType,
        legendFormat: '{{terminal_type}}',
      },
    ],
  });

  const costByOsTypeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByOsType',
        expr: QUERIES.costByOsType,
        legendFormat: '{{os_type}}',
      },
    ],
  });

  const versionAdoptionOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'VersionAdoptionOverTime',
        expr: QUERIES.versionAdoptionOverTime,
        legendFormat: '{{service_version}}',
      },
    ],
  });

  const usageByDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'UsageByDevice',
        expr: QUERIES.usageByDevice,
        legendFormat: '{{device}}',
      },
    ],
  });

  const costByDeviceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CostByDevice',
        expr: QUERIES.costByDeviceEnv,
        legendFormat: '{{device}}',
      },
    ],
  });

  const terminalTypeOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'TerminalTypeOverTime',
        expr: QUERIES.terminalTypeOverTime,
        legendFormat: '{{terminal_type}}',
      },
    ],
  });

  const codexUsageByOsQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CodexUsageByOs',
        expr: QUERIES.codexUsageByOs,
        legendFormat: `{{${LABELS.CODEX_OS}}}`,
      },
    ],
  });

  const codexUsageByOriginatorQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CodexUsageByOriginator',
        expr: QUERIES.codexUsageByOriginator,
        legendFormat: `{{${LABELS.CODEX_ORIGINATOR}}}`,
      },
    ],
  });

  const codexUsageBySessionSourceQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CodexUsageBySessionSource',
        expr: QUERIES.codexUsageBySessionSource,
        legendFormat: `{{${LABELS.CODEX_SESSION_SOURCE}}}`,
      },
    ],
  });

  const codexUsageByAppVersionQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CodexUsageByAppVersion',
        expr: QUERIES.codexUsageByAppVersion,
        legendFormat: `{{${LABELS.CODEX_APP_VERSION}}}`,
      },
    ],
  });

  const codexOriginatorOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CodexOriginatorOverTime',
        expr: QUERIES.codexOriginatorOverTime,
        legendFormat: `{{${LABELS.CODEX_ORIGINATOR}}}`,
      },
    ],
  });

  const codexVersionOverTimeQuery = new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [
      {
        refId: 'CodexVersionOverTime',
        expr: QUERIES.codexVersionOverTime,
        legendFormat: `{{${LABELS.CODEX_APP_VERSION}}}`,
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
        // Row 1: Distribution pies
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.MEDIUM,
          children: [
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Claude OS Distribution')
                .setData(usageByOsTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Claude Architecture')
                .setData(usageByHostArchQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Claude IDE / Terminal')
                .setData(usageByTerminalTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Claude Code Version')
                .setData(usageByServiceVersionQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
          ],
        }),
        // Row 2: Codex environment dimensions
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.MEDIUM,
          children: [
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Codex OS')
                .setData(codexUsageByOsQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Codex Originator')
                .setData(codexUsageByOriginatorQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Codex Source')
                .setData(codexUsageBySessionSourceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Codex App Version')
                .setData(codexUsageByAppVersionQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
          ],
        }),
        // Row 2: Device breakdown (requires OTEL_RESOURCE_ATTRIBUTES="device=...")
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Claude Usage by Device')
                .setData(usageByDeviceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Claude Cost by Device')
                .setUnit('currencyUSD')
                .setData(costByDeviceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
          ],
        }),
        // Row 3: Cost breakdown by environment
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Claude Cost by IDE / Terminal')
                .setUnit('currencyUSD')
                .setData(costByTerminalTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Claude Cost by OS')
                .setUnit('currencyUSD')
                .setData(costByOsTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
          ],
        }),
        // Row 4: Claude trends over time
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.timeseries()
                .setTitle('Claude IDE / Terminal Over Time')
                .setUnit('short')
                .setData(terminalTypeOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 20)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.timeseries()
                .setTitle('Claude Version Adoption Over Time')
                .setUnit('short')
                .setData(versionAdoptionOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 20)
                .build(),
            }),
          ],
        }),
        // Row 5: Codex trends over time
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.timeseries()
                .setTitle('Codex Originator Over Time')
                .setUnit('short')
                .setData(codexOriginatorOverTimeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 20)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.timeseries()
                .setTitle('Codex Version Over Time')
                .setUnit('short')
                .setData(codexVersionOverTimeQuery)
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
