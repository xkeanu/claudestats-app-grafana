import {
  QueryVariable,
  CustomVariable,
  DataSourceVariable,
  SceneVariableSet,
} from '@grafana/scenes';
import { METRICS, LABELS } from '../constants';

/**
 * Creates a data source variable for Prometheus/Mimir
 */
export function getPrometheusDataSourceVariable() {
  return new DataSourceVariable({
    name: 'prometheus_ds',
    label: 'Metrics',
    pluginId: 'prometheus',
    includeAll: false,
  });
}

/**
 * Creates a team member filter variable with display names
 * Only shows UUIDs discovered from Prometheus, with names applied where mappings exist
 * @param teamMembers - UUID to display name mappings
 * @param discoveredUuids - UUIDs discovered from Prometheus
 */
export function getTeamMemberVariable(
  teamMembers: Record<string, string>,
  discoveredUuids: string[] = []
) {
  // Only show UUIDs that actually exist in Prometheus
  // Apply name mappings where available
  if (discoveredUuids.length > 0) {
    // Build options string: "Label : Value, ..."
    const memberOptions = discoveredUuids
      .map((uuid) => {
        const name = teamMembers[uuid] || uuid; // Use name if mapped, otherwise UUID
        return `${name} : ${uuid}`;
      })
      .join(', ');

    return new CustomVariable({
      name: 'member',
      label: 'Team Member',
      query: `All : .*, ${memberOptions}`,
      value: '.*',
      text: 'All',
    });
  }

  // Fallback to QueryVariable when no UUIDs discovered yet
  return new QueryVariable({
    name: 'member',
    label: 'Team Member',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values(${METRICS.COST_USAGE}, ${LABELS.USER_ACCOUNT_UUID})`,
      refId: 'MemberQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}

/**
 * Creates a model filter variable (sonnet, opus, etc.)
 */
export function getModelVariable() {
  return new QueryVariable({
    name: 'model',
    label: 'Model',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values(${METRICS.COST_USAGE}, ${LABELS.MODEL})`,
      refId: 'ModelQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}

/**
 * Creates the shared variable set used across all scenes
 */
export function getSharedVariables(
  teamMembers: Record<string, string> = {},
  discoveredUuids: string[] = []
) {
  return new SceneVariableSet({
    variables: [
      getPrometheusDataSourceVariable(),
      getTeamMemberVariable(teamMembers, discoveredUuids),
      getModelVariable(),
    ],
  });
}
