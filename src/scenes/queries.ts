import { METRICS, LABELS } from '../constants';

/**
 * Common filter fragment for terminal_type, os_type, and device
 */
export const ENV_FILTERS = `${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device"`;

/**
 * PromQL query builders for Claude Code metrics
 * All queries support filtering by team member ($member), model ($model),
 * terminal type ($terminal_type), OS type ($os_type), and device ($device)
 */
export const QUERIES = {
  // ==================== COST QUERIES ====================

  /** Total cost across all users/models (time-range aware) */
  totalCost: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  /** Cost breakdown by model */
  costByModel: `sum by (${LABELS.MODEL}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Cost breakdown by device */
  costByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.COST_USAGE}{${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  /** Cost over time (rate) */
  costOverTime: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.MODEL})`,

  /** Cost over time by device */
  costOverTimeByDevice: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.DEVICE})`,

  // ==================== TOKEN QUERIES ====================

  /** Total tokens (all types) */
  totalTokens: `sum(increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  /** Tokens by type (input, output, cache_read, cache_creation) */
  tokensByType: `sum by (${LABELS.TOKEN_TYPE}) (increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  /** Tokens by model */
  tokensByModel: `sum by (${LABELS.MODEL}) (increase(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Tokens over time */
  tokensOverTime: `sum(rate(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.TOKEN_TYPE})`,

  /** Tokens by device */
  tokensByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.TOKEN_USAGE}{${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  // ==================== SESSION QUERIES ====================

  /** Total sessions - count unique session_id labels */
  totalSessions: `count(count by (${LABELS.SESSION_ID}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

  /** Sessions by device */
  sessionsByDevice: `count by (${LABELS.DEVICE}) (count by (${LABELS.SESSION_ID}, ${LABELS.DEVICE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

  /** Active users - count unique user_email labels */
  activeUsers: `count(count by (${LABELS.USER_EMAIL}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

  // ==================== PRODUCTIVITY QUERIES ====================

  /** Total lines of code (added + removed) */
  totalLinesOfCode: `sum(increase(${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Lines of code by type (added, removed) */
  linesOfCodeByType: `sum by (${LABELS.LOC_TYPE}) (increase(${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Lines of code by device */
  linesOfCodeByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.LINES_OF_CODE}{${ENV_FILTERS}}[$__range]))`,

  /** Lines of code over time */
  linesOfCodeOverTime: `sum(increase(${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.LOC_TYPE})`,

  /** Total commits */
  totalCommits: `sum(increase(${METRICS.COMMITS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Commits by device */
  commitsByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.COMMITS}{${ENV_FILTERS}}[$__range]))`,

  /** Commits over time */
  commitsOverTime: `sum(increase(${METRICS.COMMITS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]))`,

  /** Total pull requests */
  totalPullRequests: `sum(increase(${METRICS.PULL_REQUESTS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Pull requests by device */
  pullRequestsByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.PULL_REQUESTS}{${ENV_FILTERS}}[$__range]))`,

  /** Pull requests over time */
  pullRequestsOverTime: `sum(increase(${METRICS.PULL_REQUESTS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]))`,

  // ==================== ACTIVITY QUERIES ====================

  /** Total active time in seconds */
  totalActiveTime: `sum(increase(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Active time by device */
  activeTimeByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.ACTIVE_TIME}{${ENV_FILTERS}}[$__range]))`,

  /** Active time over time */
  activeTimeOverTime: `sum(increase(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]))`,

  // ==================== TOOL QUERIES ====================

  /** Tool decisions (accepted, rejected) */
  toolDecisions: `sum by (${LABELS.DECISION}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Tool decisions by tool */
  toolDecisionsByTool: `sum by (${LABELS.TOOL}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Tool acceptance rate */
  toolAcceptanceRate: `sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.DECISION}="accept", ${ENV_FILTERS}}[$__range])) / sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])) * 100`,

  // ==================== LANGUAGE QUERIES ====================

  /** Tool decisions by programming language */
  toolDecisionsByLanguage: `sum by (${LABELS.LANGUAGE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

  /** Tool decisions by language over time */
  toolDecisionsByLanguageOverTime: `sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__rate_interval])) by (${LABELS.LANGUAGE})`,

  /** Tool decisions by language and device */
  toolDecisionsByLanguageAndDevice: `sum by (${LABELS.LANGUAGE}, ${LABELS.DEVICE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

  /** Language acceptance rate */
  languageAcceptanceRate: `sum by (${LABELS.LANGUAGE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DECISION}="accept", ${LABELS.LANGUAGE}!=""}[$__range])) / sum by (${LABELS.LANGUAGE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range])) * 100`,

  /** Total unique languages */
  totalLanguages: `count(count by (${LABELS.LANGUAGE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]) > 0))`,

  // ==================== ENHANCED TOOL QUERIES ====================

  /** Tool decisions by source (how the decision was made) */
  toolDecisionsBySource: `sum by (${LABELS.DECISION_SOURCE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Tool decisions by source over time */
  toolDecisionsBySourceOverTime: `sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.DECISION_SOURCE})`,

  /** Tool decisions by language (for Tools scene) */
  toolDecisionsByToolAndLanguage: `sum by (${LABELS.TOOL}, ${LABELS.LANGUAGE}) (increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

  // ==================== ACTIVE TIME BREAKDOWN ====================

  /** Active time by type (user keyboard vs cli tool execution) */
  activeTimeByType: `sum by (${LABELS.ACTIVE_TIME_TYPE}) (increase(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Active time by type over time */
  activeTimeByTypeOverTime: `sum(increase(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.ACTIVE_TIME_TYPE})`,

  // ==================== ENVIRONMENT QUERIES ====================

  /** Usage by OS type (darwin, linux, windows) */
  usageByOsType: `sum by (${LABELS.OS_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Usage by host architecture (arm64, x64) */
  usageByHostArch: `sum by (${LABELS.HOST_ARCH}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Usage by terminal type */
  usageByTerminalType: `sum by (${LABELS.TERMINAL_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Usage by service version */
  usageByServiceVersion: `sum by (${LABELS.SERVICE_VERSION}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Cost by terminal type */
  costByTerminalType: `sum by (${LABELS.TERMINAL_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  /** Sessions by terminal type */
  sessionsByTerminalType: `count by (${LABELS.TERMINAL_TYPE}) (count by (${LABELS.SESSION_ID}, ${LABELS.TERMINAL_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

  /** Members by OS type */
  membersByOsType: `count by (${LABELS.OS_TYPE}) (count by (${LABELS.USER_EMAIL}, ${LABELS.OS_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

  /** Cost by OS type */
  costByOsType: `sum by (${LABELS.OS_TYPE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  /** Version adoption over time */
  versionAdoptionOverTime: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.SERVICE_VERSION})`,

  /** Terminal type usage over time */
  terminalTypeOverTime: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.TERMINAL_TYPE})`,

  /** Usage by device */
  usageByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range]))`,

  /** Cost by device (environment scene — includes member filter) */
  costByDeviceEnv: `sum by (${LABELS.DEVICE}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range]))`,

  // ==================== COST TABLE QUERIES ====================

  /** Cost table by device and model */
  costTableByDevice: `sum by (${LABELS.DEVICE}, ${LABELS.MODEL}) (increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

} as const;
