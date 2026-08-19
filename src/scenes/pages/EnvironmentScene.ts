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
import { StackingMode } from '@grafana/schema';
import { QUERIES } from '../queries';
import { barPanel, piePanel, timeseriesPanel } from '../viz/panels';
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
              // Stays a pie: `os_type` is a bounded three-value set.
              body: piePanel({ title: 'Claude OS Distribution', quantity: 'count', data: usageByOsTypeQuery }).build(),
            }),
            new SceneFlexItem({
              width: '25%',
              // Stays a pie: `host_arch` is a bounded set.
              body: piePanel({ title: 'Claude Architecture', quantity: 'count', data: usageByHostArchQuery }).build(),
            }),
            new SceneFlexItem({
              width: '25%',
              // Converts pie -> bar: `terminal_type` takes the default bar limit.
              body: barPanel({
                title: 'Claude IDE / Terminal',
                quantity: 'count',
                data: usageByTerminalTypeQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
            new SceneFlexItem({
              width: '25%',
              // Converts pie -> bar: `service_version` grows without bound as releases ship.
              body: barPanel({
                title: 'Claude Code Version',
                quantity: 'count',
                data: usageByServiceVersionQuery,
                cluster: { mode: 'additive' },
              }).build(),
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
              // Stays a pie: Codex `os` is a bounded set.
              body: piePanel({ title: 'Codex OS', quantity: 'count', data: codexUsageByOsQuery }).build(),
            }),
            new SceneFlexItem({
              width: '25%',
              // Stays a pie: Codex `originator` is a bounded set.
              body: piePanel({ title: 'Codex Originator', quantity: 'count', data: codexUsageByOriginatorQuery }).build(),
            }),
            new SceneFlexItem({
              width: '25%',
              // Stays a pie: Codex `session_source` is a bounded set.
              body: piePanel({ title: 'Codex Source', quantity: 'count', data: codexUsageBySessionSourceQuery }).build(),
            }),
            new SceneFlexItem({
              width: '25%',
              // Converts pie -> bar: Codex `app_version` grows without bound as releases ship.
              body: barPanel({
                title: 'Codex App Version',
                quantity: 'count',
                data: codexUsageByAppVersionQuery,
                cluster: { mode: 'additive' },
              }).build(),
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
              // Converts pie -> bar: `device` grows with the team.
              body: barPanel({
                title: 'Claude Usage by Device',
                quantity: 'count',
                data: usageByDeviceQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
            new SceneFlexItem({
              width: '50%',
              // Converts pie -> bar: `device` grows with the team.
              body: barPanel({
                title: 'Claude Cost by Device',
                quantity: 'cost',
                data: costByDeviceQuery,
                cluster: { mode: 'additive' },
              }).build(),
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
              // Converts pie -> bar: A ranked comparison over `terminal_type`.
              body: barPanel({
                title: 'Claude Cost by IDE / Terminal',
                quantity: 'cost',
                data: costByTerminalTypeQuery,
                cluster: { mode: 'additive' },
              }).build(),
            }),
            new SceneFlexItem({
              width: '50%',
              // Stays a pie: `os_type` is a bounded three-value set.
              body: piePanel({ title: 'Claude Cost by OS', quantity: 'cost', data: costByOsTypeQuery }).build(),
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
              // Clustered on `terminal_type`.
              body: timeseriesPanel({
                title: 'Claude IDE / Terminal Over Time',
                quantity: 'count',
                data: terminalTypeOverTimeQuery,
                cluster: { mode: 'additive' },
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 20)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              // Clustered on `service_version`.
              body: timeseriesPanel({
                title: 'Claude Version Adoption Over Time',
                quantity: 'count',
                data: versionAdoptionOverTimeQuery,
                cluster: { mode: 'additive' },
              })
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
              // Clustered on `originator`.
              body: timeseriesPanel({
                title: 'Codex Originator Over Time',
                quantity: 'count',
                data: codexOriginatorOverTimeQuery,
                cluster: { mode: 'additive' },
              })
                .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
                .setCustomFieldConfig('fillOpacity', 20)
                .build(),
            }),
            new SceneFlexItem({
              width: '50%',
              // Clustered on `app_version`.
              body: timeseriesPanel({
                title: 'Codex Version Over Time',
                quantity: 'count',
                data: codexVersionOverTimeQuery,
                cluster: { mode: 'additive' },
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
