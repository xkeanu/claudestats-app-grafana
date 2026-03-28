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
import { PANEL_HEIGHTS } from '../../constants';

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
        instant: true,
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
        instant: true,
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
        instant: true,
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
        instant: true,
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
        instant: true,
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
        instant: true,
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
        instant: true,
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
        instant: true,
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
        // Row 1: Distribution pies
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.MEDIUM,
          children: [
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('OS Distribution')
                .setData(usageByOsTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('Architecture')
                .setData(usageByHostArchQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.List, placement: 'bottom' })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '25%',
              body: PanelBuilders.piechart()
                .setTitle('IDE / Terminal')
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
        // Row 2: Device breakdown (requires OTEL_RESOURCE_ATTRIBUTES="device=...")
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Usage by Device')
                .setData(usageByDeviceQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .setOption('pieType', 'donut' as never)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Cost by Device')
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
                .setTitle('Cost by IDE / Terminal')
                .setUnit('currencyUSD')
                .setData(costByTerminalTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.piechart()
                .setTitle('Cost by OS')
                .setUnit('currencyUSD')
                .setData(costByOsTypeQuery)
                .setOption('legend', { displayMode: LegendDisplayMode.Table, placement: 'right', values: ['value', 'percent'] as never })
                .build(),
            }),
          ],
        }),
        // Row 4: Trends over time
        new SceneFlexLayout({
          direction: 'row',
          height: PANEL_HEIGHTS.LARGE,
          children: [
            new SceneFlexItem({
              width: '50%',
              body: PanelBuilders.timeseries()
                .setTitle('IDE / Terminal Usage Over Time')
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
                .setTitle('Version Adoption Over Time')
                .setUnit('short')
                .setData(versionAdoptionOverTimeQuery)
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
