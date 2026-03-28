import { METRICS, LABELS } from '../constants';

/**
 * Common filter fragment for terminal_type, os_type, and device
 */
const ENV_FILTERS = `${LABELS.TERMINAL_TYPE}=~"$terminal_type", ${LABELS.OS_TYPE}=~"$os_type", ${LABELS.DEVICE}=~"$device"`;

/**
 * PromQL query builders for Claude Code metrics
 * All queries support filtering by team member ($member), model ($model),
 * terminal type ($terminal_type), OS type ($os_type), and device ($device)
 */
export const QUERIES = {
  // ==================== COST QUERIES ====================

  /** Total cost across all users/models (instant) */
  totalCost: `sum(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}})`,

  /** Cost breakdown by model */
  costByModel: `sum by (${LABELS.MODEL}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Cost breakdown by team member */
  costByMember: `sum by (${LABELS.USER_EMAIL}) (${METRICS.COST_USAGE}{${LABELS.MODEL}=~"$model", ${ENV_FILTERS}})`,

  /** Cost over time (rate) */
  costOverTime: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.MODEL})`,

  /** Cost over time by member */
  costOverTimeByMember: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.USER_EMAIL})`,

  // ==================== TOKEN QUERIES ====================

  /** Total tokens (all types) */
  totalTokens: `sum(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}})`,

  /** Tokens by type (input, output, cache_read, cache_creation) */
  tokensByType: `sum by (${LABELS.TOKEN_TYPE}) (${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}})`,

  /** Tokens by model */
  tokensByModel: `sum by (${LABELS.MODEL}) (${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Tokens over time */
  tokensOverTime: `sum(rate(${METRICS.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.TOKEN_TYPE})`,

  /** Tokens by member */
  tokensByMember: `sum by (${LABELS.USER_EMAIL}) (${METRICS.TOKEN_USAGE}{${LABELS.MODEL}=~"$model", ${ENV_FILTERS}})`,

  // ==================== SESSION QUERIES ====================

  /** Total sessions - count unique session_id labels */
  totalSessions: `count(count by (${LABELS.SESSION_ID}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}))`,

  /** Sessions by member */
  sessionsByMember: `count by (${LABELS.USER_EMAIL}) (count by (${LABELS.SESSION_ID}, ${LABELS.USER_EMAIL}) (${METRICS.COST_USAGE}{${ENV_FILTERS}}))`,

  /** Active users - count unique user_email labels */
  activeUsers: `count(count by (${LABELS.USER_EMAIL}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}))`,

  // ==================== PRODUCTIVITY QUERIES ====================

  /** Total lines of code (added + removed) */
  totalLinesOfCode: `sum(${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Lines of code by type (added, removed) */
  linesOfCodeByType: `sum by (${LABELS.LOC_TYPE}) (${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Lines of code by member */
  linesOfCodeByMember: `sum by (${LABELS.USER_EMAIL}) (${METRICS.LINES_OF_CODE}{${ENV_FILTERS}})`,

  /** Lines of code over time */
  linesOfCodeOverTime: `sum(increase(${METRICS.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.LOC_TYPE})`,

  /** Total commits */
  totalCommits: `sum(${METRICS.COMMITS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Commits by member */
  commitsByMember: `sum by (${LABELS.USER_EMAIL}) (${METRICS.COMMITS}{${ENV_FILTERS}})`,

  /** Commits over time */
  commitsOverTime: `sum(increase(${METRICS.COMMITS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]))`,

  /** Total pull requests */
  totalPullRequests: `sum(${METRICS.PULL_REQUESTS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Pull requests by member */
  pullRequestsByMember: `sum by (${LABELS.USER_EMAIL}) (${METRICS.PULL_REQUESTS}{${ENV_FILTERS}})`,

  /** Pull requests over time */
  pullRequestsOverTime: `sum(increase(${METRICS.PULL_REQUESTS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]))`,

  // ==================== ACTIVITY QUERIES ====================

  /** Total active time in seconds */
  totalActiveTime: `sum(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Active time by member */
  activeTimeByMember: `sum by (${LABELS.USER_EMAIL}) (${METRICS.ACTIVE_TIME}{${ENV_FILTERS}})`,

  /** Active time over time */
  activeTimeOverTime: `sum(increase(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]))`,

  // ==================== TOOL QUERIES ====================

  /** Tool decisions (accepted, rejected) */
  toolDecisions: `sum by (${LABELS.DECISION}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Tool decisions by tool */
  toolDecisionsByTool: `sum by (${LABELS.TOOL}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Tool acceptance rate */
  toolAcceptanceRate: `sum(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.DECISION}="accept", ${ENV_FILTERS}}) / sum(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}) * 100`,

  // ==================== LANGUAGE QUERIES ====================

  /** Tool decisions by programming language */
  toolDecisionsByLanguage: `sum by (${LABELS.LANGUAGE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""})`,

  /** Tool decisions by language over time */
  toolDecisionsByLanguageOverTime: `sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__rate_interval])) by (${LABELS.LANGUAGE})`,

  /** Tool decisions by language and member */
  toolDecisionsByLanguageAndMember: `sum by (${LABELS.LANGUAGE}, ${LABELS.USER_EMAIL}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""})`,

  /** Language acceptance rate */
  languageAcceptanceRate: `sum by (${LABELS.LANGUAGE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DECISION}="accept", ${LABELS.LANGUAGE}!=""}) / sum by (${LABELS.LANGUAGE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}) * 100`,

  /** Total unique languages */
  totalLanguages: `count(count by (${LABELS.LANGUAGE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}))`,

  // ==================== ENHANCED TOOL QUERIES ====================

  /** Tool decisions by source (how the decision was made) */
  toolDecisionsBySource: `sum by (${LABELS.DECISION_SOURCE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Tool decisions by source over time */
  toolDecisionsBySourceOverTime: `sum(increase(${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.DECISION_SOURCE})`,

  /** Tool decisions by language (for Tools scene) */
  toolDecisionsByToolAndLanguage: `sum by (${LABELS.TOOL}, ${LABELS.LANGUAGE}) (${METRICS.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""})`,

  // ==================== ACTIVE TIME BREAKDOWN ====================

  /** Active time by type (user keyboard vs cli tool execution) */
  activeTimeByType: `sum by (${LABELS.ACTIVE_TIME_TYPE}) (${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Active time by type over time */
  activeTimeByTypeOverTime: `sum(increase(${METRICS.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.ACTIVE_TIME_TYPE})`,

  // ==================== ENVIRONMENT QUERIES ====================

  /** Usage by OS type (darwin, linux, windows) */
  usageByOsType: `sum by (${LABELS.OS_TYPE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Usage by host architecture (arm64, x64) */
  usageByHostArch: `sum by (${LABELS.HOST_ARCH}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Usage by terminal type */
  usageByTerminalType: `sum by (${LABELS.TERMINAL_TYPE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Usage by service version */
  usageByServiceVersion: `sum by (${LABELS.SERVICE_VERSION}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}})`,

  /** Cost by terminal type */
  costByTerminalType: `sum by (${LABELS.TERMINAL_TYPE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}})`,

  /** Sessions by terminal type */
  sessionsByTerminalType: `count by (${LABELS.TERMINAL_TYPE}) (count by (${LABELS.SESSION_ID}, ${LABELS.TERMINAL_TYPE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}))`,

  /** Members by OS type */
  membersByOsType: `count by (${LABELS.OS_TYPE}) (count by (${LABELS.USER_EMAIL}, ${LABELS.OS_TYPE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}))`,

  /** Cost by OS type */
  costByOsType: `sum by (${LABELS.OS_TYPE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}})`,

  /** Version adoption over time */
  versionAdoptionOverTime: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.SERVICE_VERSION})`,

  /** Terminal type usage over time */
  terminalTypeOverTime: `sum(increase(${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.TERMINAL_TYPE})`,

  /** Usage by device */
  usageByDevice: `sum by (${LABELS.DEVICE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""})`,

  /** Cost by device */
  costByDevice: `sum by (${LABELS.DEVICE}) (${METRICS.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""})`,

} as const;
