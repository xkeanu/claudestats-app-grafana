import {
  QueryVariable,
  DataSourceVariable,
  CustomVariable,
  SceneVariableSet,
} from '@grafana/scenes';
import { METRICS, LABELS, CODING_TOOLS } from '../constants';

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
 * Creates a team member filter variable using user_email
 */
export function getTeamMemberVariable() {
  return new QueryVariable({
    name: 'member',
    label: 'Team Member',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values(${METRICS.COST_USAGE}, ${LABELS.USER_EMAIL})`,
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
      query: `label_values({__name__=~"${METRICS.CLAUDE_CODE.COST_USAGE}|${METRICS.CLAUDE_CODE.TOKEN_USAGE}|${METRICS.CODEX.TURN_TOKEN_USAGE}|${METRICS.CODEX.API_REQUEST}|${METRICS.CODEX.TOOL_CALL}"}, ${LABELS.MODEL})`,
      refId: 'ModelQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}

/**
 * Creates a terminal/IDE filter variable
 */
export function getTerminalTypeVariable() {
  return new QueryVariable({
    name: 'terminal_type',
    label: 'IDE / Terminal',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values(${METRICS.COST_USAGE}, ${LABELS.TERMINAL_TYPE})`,
      refId: 'TerminalTypeQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}

/**
 * Creates an OS type filter variable
 */
export function getOsTypeVariable() {
  return new QueryVariable({
    name: 'os_type',
    label: 'OS',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values(${METRICS.COST_USAGE}, ${LABELS.OS_TYPE})`,
      refId: 'OsTypeQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}

/**
 * Creates a device name filter variable
 * Users set device names via OTEL_RESOURCE_ATTRIBUTES="device=my-macbook"
 */
export function getDeviceVariable() {
  return new QueryVariable({
    name: 'device',
    label: 'Device',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values(${METRICS.COST_USAGE}, ${LABELS.DEVICE})`,
      refId: 'DeviceQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}

/**
 * Creates a coding tool selector for Claude Code and Codex
 */
export function getCodingToolVariable() {
  return new CustomVariable({
    name: 'coding_tool',
    label: 'Coding Tool',
    query: `Claude Code : ${CODING_TOOLS.CLAUDE_CODE}, Codex : ${CODING_TOOLS.CODEX}`,
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}

/**
 * Creates a Codex originator filter variable (desktop, CLI, app server, etc.)
 */
export function getCodexOriginatorVariable() {
  return new QueryVariable({
    name: 'codex_originator',
    label: 'Codex Originator',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values({__name__=~"${METRICS.CODEX.TURN_TOKEN_USAGE}|${METRICS.CODEX.API_REQUEST}|${METRICS.CODEX.TOOL_CALL}"}, ${LABELS.CODEX_ORIGINATOR})`,
      refId: 'CodexOriginatorQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}

/**
 * Creates a Codex session-source filter variable (CLI, VS Code, subagent, etc.)
 */
export function getCodexSessionSourceVariable() {
  return new QueryVariable({
    name: 'codex_session_source',
    label: 'Codex Source',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values({__name__=~"${METRICS.CODEX.TURN_TOKEN_USAGE}|${METRICS.CODEX.API_REQUEST}|${METRICS.CODEX.TOOL_CALL}"}, ${LABELS.CODEX_SESSION_SOURCE})`,
      refId: 'CodexSessionSourceQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}

/**
 * Creates a Codex OS filter variable. Claude Code OS remains in os_type.
 */
export function getCodexOsVariable() {
  return new QueryVariable({
    name: 'codex_os',
    label: 'Codex OS',
    datasource: {
      type: 'prometheus',
      uid: '${prometheus_ds}',
    },
    query: {
      query: `label_values({__name__=~"${METRICS.CODEX.TURN_TOKEN_USAGE}|${METRICS.CODEX.API_REQUEST}|${METRICS.CODEX.TOOL_CALL}"}, ${LABELS.CODEX_OS})`,
      refId: 'CodexOsQuery',
    },
    includeAll: true,
    defaultToAll: true,
    allValue: '.*',
  });
}

/**
 * Creates the shared variable set used across all scenes
 */
export function getSharedVariables() {
  return new SceneVariableSet({
    variables: [
      getPrometheusDataSourceVariable(),
      getTeamMemberVariable(),
      getModelVariable(),
      getCodingToolVariable(),
      getTerminalTypeVariable(),
      getOsTypeVariable(),
      getDeviceVariable(),
      getCodexOriginatorVariable(),
      getCodexSessionSourceVariable(),
      getCodexOsVariable(),
    ],
  });
}
