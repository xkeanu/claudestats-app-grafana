import { METRICS, LABELS } from '../constants';

/**
 * Claude Code filter fragment. Codex uses different labels, so Codex queries
 * use a separate filter below instead of forcing every exporter into one shape.
 */
export const ENV_FILTERS = `${LABELS.JOB}=~"\${coding_tool:raw}", ${LABELS.TERMINAL_TYPE}=~"\${terminal_type:regex}", ${LABELS.OS_TYPE}=~"\${os_type:regex}", ${LABELS.DEVICE}=~"\${device:regex}"`;
const CODEX_CONTEXT_FILTER = `${LABELS.JOB}=~"\${coding_tool:raw}", ${LABELS.MODEL}=~"\${model:regex}", ${LABELS.CODEX_ORIGINATOR}=~"\${codex_originator:regex}", ${LABELS.CODEX_SESSION_SOURCE}=~"\${codex_session_source:regex}", ${LABELS.CODEX_OS}=~"\${codex_os:regex}"`;
const CODEX_BASE_FILTER = `${LABELS.JOB}=~"\${coding_tool:raw}"`;

/**
 * PromQL query builders for Claude Code and Codex metrics
 * Claude Code queries support filtering by team member ($member), model ($model),
 * terminal type ($terminal_type), OS type ($os_type), and device ($device).
 * Codex queries support filtering by model ($model), originator
 * ($codex_originator), session source ($codex_session_source), and OS ($codex_os).
 */
export const QUERIES = {
  // ==================== COST QUERIES ====================

  /** Total cost across all users/models (time-range aware) */
  totalCost: `sum(increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  /** Cost breakdown by model */
  costByModel: `sum by (${LABELS.MODEL}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Cost breakdown by device */
  costByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range]))`,

  /** Cost over time (rate) */
  costOverTime: `sum(increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.MODEL})`,

  /** Cost over time by device */
  costOverTimeByDevice: `sum(increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__rate_interval])) by (${LABELS.DEVICE})`,

  // ==================== TOKEN QUERIES ====================

  /** Total tokens (all types) */
  totalTokens: `(sum(increase(${METRICS.CLAUDE_CODE.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range])) or vector(0)) + (sum(increase(${METRICS.CODEX.TURN_TOKEN_USAGE}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_TOKEN_TYPE}="total"}[$__range])) or vector(0))`,

  /** Input tokens across supported coding tools */
  inputTokens: `(sum(increase(${METRICS.CLAUDE_CODE.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${LABELS.TOKEN_TYPE}="input", ${ENV_FILTERS}}[$__range])) or vector(0)) + (sum(increase(${METRICS.CODEX.TURN_TOKEN_USAGE}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_TOKEN_TYPE}="input"}[$__range])) or vector(0))`,

  /** Output tokens across supported coding tools */
  outputTokens: `(sum(increase(${METRICS.CLAUDE_CODE.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${LABELS.TOKEN_TYPE}="output", ${ENV_FILTERS}}[$__range])) or vector(0)) + (sum(increase(${METRICS.CODEX.TURN_TOKEN_USAGE}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_TOKEN_TYPE}="output"}[$__range])) or vector(0))`,

  /** Cache-read tokens across supported coding tools */
  cacheReadTokens: `(sum(increase(${METRICS.CLAUDE_CODE.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${LABELS.TOKEN_TYPE}="cacheRead", ${ENV_FILTERS}}[$__range])) or vector(0)) + (sum(increase(${METRICS.CODEX.TURN_TOKEN_USAGE}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_TOKEN_TYPE}="cached_input"}[$__range])) or vector(0))`,

  /** Tokens by type (input, output, cacheRead, cacheCreation) */
  tokensByType: `sum by (${LABELS.TOKEN_TYPE}) (increase(${METRICS.CLAUDE_CODE.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]) or label_replace(increase(${METRICS.CODEX.TURN_TOKEN_USAGE}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_TOKEN_TYPE}!="total"}[$__range]), "${LABELS.TOKEN_TYPE}", "$1", "${LABELS.CODEX_TOKEN_TYPE}", "(.*)"))`,

  /** Tokens by model */
  tokensByModel: `sum by (${LABELS.MODEL}) (increase(${METRICS.CLAUDE_CODE.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) or increase(${METRICS.CODEX.TURN_TOKEN_USAGE}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_TOKEN_TYPE}="total"}[$__range]))`,

  /** Tokens over time */
  tokensOverTime: `sum by (${LABELS.TOKEN_TYPE}) (rate(${METRICS.CLAUDE_CODE.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval]) or label_replace(rate(${METRICS.CODEX.TURN_TOKEN_USAGE}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_TOKEN_TYPE}!="total"}[$__rate_interval]), "${LABELS.TOKEN_TYPE}", "$1", "${LABELS.CODEX_TOKEN_TYPE}", "(.*)"))`,

  /** Tokens by device */
  tokensByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range]))`,

  // ==================== SESSION QUERIES ====================

  /** Total sessions. Codex session analog is thread_started (a turn is not a session). */
  totalSessions: `round((sum(increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])) or vector(0)) + (sum(increase(${METRICS.CODEX.THREAD_STARTED}{${CODEX_CONTEXT_FILTER}}[$__range])) or vector(0)))`,

  /** Sessions by device */
  sessionsByDevice: `round(sum by (${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range])))`,

  /** Average tokens per session */
  avgTokensPerSession: `((sum(increase(${METRICS.CLAUDE_CODE.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range])) or vector(0)) + (sum(increase(${METRICS.CODEX.TURN_TOKEN_USAGE}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_TOKEN_TYPE}="total"}[$__range])) or vector(0))) / clamp_min(((sum(increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])) or vector(0)) + (sum(increase(${METRICS.CODEX.THREAD_STARTED}{${CODEX_CONTEXT_FILTER}}[$__range])) or vector(0))), 1)`,

  /** Average active time per session */
  avgActiveTimePerSession: `(sum(increase(${METRICS.CLAUDE_CODE.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])) or vector(0)) / clamp_min(round(sum(increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))) or vector(0), 1)`,

  /** Average cost per session */
  avgCostPerSession: `(sum(increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range])) or vector(0)) / clamp_min(round(sum(increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))) or vector(0), 1)`,

  /** Sessions over time by device */
  sessionsOverTime: `round(sum by (${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__rate_interval])))`,

  /** Tokens per session over time */
  sessionIntensityOverTime: `(sum(increase(${METRICS.CLAUDE_CODE.TOKEN_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__rate_interval])) or vector(0)) / clamp_min(round(sum(increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]))) or vector(0), 1)`,

  /** Sessions by model */
  sessionsByModel: `round(sum by (${LABELS.MODEL}) (increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]) or increase(${METRICS.CODEX.THREAD_STARTED}{${CODEX_CONTEXT_FILTER}}[$__range])))`,

  /** Active users over time */
  activeUsersOverTime: `count(count by (${LABELS.USER_EMAIL}) (increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]) > 0))`,

  /** Active users - count unique user_email labels with session activity */
  activeUsers: `count(count by (${LABELS.USER_EMAIL}) (increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

  // ==================== PRODUCTIVITY QUERIES ====================

  /** Total lines of code (added + removed) */
  totalLinesOfCode: `round(sum(increase(${METRICS.CLAUDE_CODE.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])))`,

  /** Lines of code by type (added, removed) */
  linesOfCodeByType: `round(sum by (${LABELS.LOC_TYPE}) (increase(${METRICS.CLAUDE_CODE.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])))`,

  /** Lines of code by device */
  linesOfCodeByDevice: `round(sum by (${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range])))`,

  /** Lines of code over time */
  linesOfCodeOverTime: `round(sum(increase(${METRICS.CLAUDE_CODE.LINES_OF_CODE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.LOC_TYPE}))`,

  /** Total commits */
  totalCommits: `round(sum(increase(${METRICS.CLAUDE_CODE.COMMITS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])))`,

  /** Commits by device */
  commitsByDevice: `round(sum by (${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.COMMITS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range])))`,

  /** Commits over time */
  commitsOverTime: `round(sum(increase(${METRICS.CLAUDE_CODE.COMMITS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) or vector(0))`,

  /** Total pull requests */
  totalPullRequests: `round(sum(increase(${METRICS.CLAUDE_CODE.PULL_REQUESTS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])))`,

  /** Pull requests by device */
  pullRequestsByDevice: `round(sum by (${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.PULL_REQUESTS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range])))`,

  /** Pull requests over time */
  pullRequestsOverTime: `round(sum(increase(${METRICS.CLAUDE_CODE.PULL_REQUESTS}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) or vector(0))`,

  // ==================== ACTIVITY QUERIES ====================

  /** Total active time in seconds */
  totalActiveTime: `sum(increase(${METRICS.CLAUDE_CODE.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Active time by device */
  activeTimeByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range]))`,

  /** Active time over time */
  activeTimeOverTime: `sum(increase(${METRICS.CLAUDE_CODE.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]))`,

  // ==================== TOOL QUERIES ====================

  /** Tool decisions (accepted, rejected). Codex contributes its guardian
   * auto-review decisions: approved -> accept, denied -> reject. */
  toolDecisions: `sum by (${LABELS.DECISION}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) or label_replace(increase(${METRICS.CODEX.GUARDIAN_REVIEW}{${CODEX_BASE_FILTER}, ${LABELS.CODEX_DECISION}="approved"}[$__range]), "${LABELS.DECISION}", "accept", "__name__", ".*") or label_replace(increase(${METRICS.CODEX.GUARDIAN_REVIEW}{${CODEX_BASE_FILTER}, ${LABELS.CODEX_DECISION}="denied"}[$__range]), "${LABELS.DECISION}", "reject", "__name__", ".*"))`,

  /** Tool decisions by tool */
  toolDecisionsByTool: `sum by (${LABELS.TOOL}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) or label_replace(increase(${METRICS.CODEX.TOOL_CALL}{${CODEX_CONTEXT_FILTER}}[$__range]), "${LABELS.TOOL}", "$1", "${LABELS.CODEX_TOOL}", "(.*)"))`,

  /** Tool acceptance rate. Codex contributes guardian approved / all reviews. */
  toolAcceptanceRate: `((sum(increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.DECISION}="accept", ${ENV_FILTERS}}[$__range])) or vector(0)) + (sum(increase(${METRICS.CODEX.GUARDIAN_REVIEW}{${CODEX_BASE_FILTER}, ${LABELS.CODEX_DECISION}="approved"}[$__range])) or vector(0))) / clamp_min((sum(increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])) or vector(0)) + (sum(increase(${METRICS.CODEX.GUARDIAN_REVIEW}{${CODEX_BASE_FILTER}}[$__range])) or vector(0)), 1) * 100`,

  /** Tool decisions over time. Codex guardian: approved -> accept, denied -> reject. */
  toolDecisionsOverTime: `sum by (${LABELS.DECISION}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval]) or label_replace(increase(${METRICS.CODEX.GUARDIAN_REVIEW}{${CODEX_BASE_FILTER}, ${LABELS.CODEX_DECISION}="approved"}[$__rate_interval]), "${LABELS.DECISION}", "accept", "__name__", ".*") or label_replace(increase(${METRICS.CODEX.GUARDIAN_REVIEW}{${CODEX_BASE_FILTER}, ${LABELS.CODEX_DECISION}="denied"}[$__rate_interval]), "${LABELS.DECISION}", "reject", "__name__", ".*"))`,

  // ==================== LANGUAGE QUERIES ====================

  /** Tool decisions by programming language */
  toolDecisionsByLanguage: `sum by (${LABELS.LANGUAGE}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

  /** Tool decisions by language over time */
  toolDecisionsByLanguageOverTime: `sum(increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__rate_interval])) by (${LABELS.LANGUAGE})`,

  /** Tool decisions by language and device */
  toolDecisionsByLanguageAndDevice: `sum by (${LABELS.LANGUAGE}, ${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!="", ${LABELS.DEVICE}!=""}[$__range]))`,

  /** Language acceptance rate */
  languageAcceptanceRate: `((sum by (${LABELS.LANGUAGE}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DECISION}="accept", ${LABELS.LANGUAGE}!=""}[$__range]))) or (sum by (${LABELS.LANGUAGE}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range])) * 0)) / clamp_min(sum by (${LABELS.LANGUAGE}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range])), 1) * 100`,

  /** Total unique languages */
  totalLanguages: `count(count by (${LABELS.LANGUAGE}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]) > 0))`,

  /** Total edits across all languages */
  totalLanguageEdits: `sum(increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

  /** Overall acceptance rate across all languages */
  overallLanguageAcceptanceRate: `(sum(increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DECISION}="accept", ${LABELS.LANGUAGE}!=""}[$__range])) or vector(0)) / clamp_min(sum(increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range])) or vector(0), 1) * 100`,

  /** Tool decisions by language and team member */
  toolDecisionsByLanguageAndMember: `sum by (${LABELS.LANGUAGE}, ${LABELS.USER_EMAIL}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

  // ==================== ENHANCED TOOL QUERIES ====================

  /** Tool decisions by source (how the decision was made) */
  toolDecisionsBySource: `sum by (${LABELS.DECISION_SOURCE}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Tool decisions by source over time */
  toolDecisionsBySourceOverTime: `sum(increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.DECISION_SOURCE})`,

  /** Tool decisions by language (for Tools scene) */
  toolDecisionsByToolAndLanguage: `sum by (${LABELS.TOOL}, ${LABELS.LANGUAGE}) (increase(${METRICS.CLAUDE_CODE.TOOL_DECISION}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.LANGUAGE}!=""}[$__range]))`,

  // ==================== ACTIVE TIME BREAKDOWN ====================

  /** Active time by type (user keyboard vs cli tool execution) */
  activeTimeByType: `sum by (${LABELS.ACTIVE_TIME_TYPE}) (increase(${METRICS.CLAUDE_CODE.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Active time by type over time */
  activeTimeByTypeOverTime: `sum(increase(${METRICS.CLAUDE_CODE.ACTIVE_TIME}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.ACTIVE_TIME_TYPE})`,

  // ==================== ENVIRONMENT QUERIES ====================

  /** Usage by OS type (darwin, linux, windows) */
  usageByOsType: `sum by (${LABELS.OS_TYPE}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Usage by host architecture (arm64, x64) */
  usageByHostArch: `sum by (${LABELS.HOST_ARCH}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Usage by terminal type */
  usageByTerminalType: `sum by (${LABELS.TERMINAL_TYPE}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Usage by service version */
  usageByServiceVersion: `sum by (${LABELS.SERVICE_VERSION}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]))`,

  /** Cost by terminal type */
  costByTerminalType: `sum by (${LABELS.TERMINAL_TYPE}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  /** Sessions by terminal type */
  sessionsByTerminalType: `round(sum by (${LABELS.TERMINAL_TYPE}) (increase(${METRICS.CLAUDE_CODE.SESSION_COUNT}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range])))`,

  /** Members by OS type */
  membersByOsType: `count by (${LABELS.OS_TYPE}) (count by (${LABELS.USER_EMAIL}, ${LABELS.OS_TYPE}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__range]) > 0))`,

  /** Cost by OS type */
  costByOsType: `sum by (${LABELS.OS_TYPE}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  /** Version adoption over time */
  versionAdoptionOverTime: `sum(increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.SERVICE_VERSION})`,

  /** Terminal type usage over time */
  terminalTypeOverTime: `sum(increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}}[$__rate_interval])) by (${LABELS.TERMINAL_TYPE})`,

  /** Usage by device */
  usageByDevice: `sum by (${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range]))`,

  /** Cost by device (environment scene — includes member filter) */
  costByDeviceEnv: `sum by (${LABELS.DEVICE}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}, ${LABELS.DEVICE}!=""}[$__range]))`,

  // ==================== COST TABLE QUERIES ====================

  /** Cost table by device and model */
  costTableByDevice: `sum by (${LABELS.DEVICE}, ${LABELS.MODEL}) (increase(${METRICS.CLAUDE_CODE.COST_USAGE}{${LABELS.USER_EMAIL}=~"$member", ${LABELS.MODEL}=~"$model", ${ENV_FILTERS}}[$__range]))`,

  // ==================== CODEX ENVIRONMENT QUERIES ====================

  /** Codex usage by OS */
  codexUsageByOs: `sum by (${LABELS.CODEX_OS}) (increase(${METRICS.CODEX.API_REQUEST}{${CODEX_CONTEXT_FILTER}}[$__range]))`,

  /** Codex usage by originator */
  codexUsageByOriginator: `sum by (${LABELS.CODEX_ORIGINATOR}) (increase(${METRICS.CODEX.API_REQUEST}{${CODEX_CONTEXT_FILTER}}[$__range]))`,

  /** Codex usage by session source */
  codexUsageBySessionSource: `sum by (${LABELS.CODEX_SESSION_SOURCE}) (increase(${METRICS.CODEX.API_REQUEST}{${CODEX_CONTEXT_FILTER}}[$__range]))`,

  /** Codex usage by app version */
  codexUsageByAppVersion: `sum by (${LABELS.CODEX_APP_VERSION}) (increase(${METRICS.CODEX.API_REQUEST}{${CODEX_CONTEXT_FILTER}}[$__range]))`,

  /** Codex API requests by originator over time */
  codexOriginatorOverTime: `sum by (${LABELS.CODEX_ORIGINATOR}) (increase(${METRICS.CODEX.API_REQUEST}{${CODEX_CONTEXT_FILTER}}[$__rate_interval]))`,

  /** Codex version adoption over time */
  codexVersionOverTime: `sum by (${LABELS.CODEX_APP_VERSION}) (increase(${METRICS.CODEX.API_REQUEST}{${CODEX_CONTEXT_FILTER}}[$__rate_interval]))`,

  // ==================== CODEX QUERIES ====================

  /** Total Codex tokens across turns */
  codexTotalTokens: `sum(increase(${METRICS.CODEX.TURN_TOKEN_USAGE}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_TOKEN_TYPE}="total"}[$__range]))`,

  /** Codex tokens by token type */
  codexTokensByType: `sum by (${LABELS.CODEX_TOKEN_TYPE}) (increase(${METRICS.CODEX.TURN_TOKEN_USAGE}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_TOKEN_TYPE}!="total"}[$__range]))`,

  /** Codex tool calls by tool name */
  codexToolCallsByTool: `sum by (${LABELS.CODEX_TOOL}) (increase(${METRICS.CODEX.TOOL_CALL}{${CODEX_CONTEXT_FILTER}}[$__range]))`,

  /** Codex guardian auto-review approval rate (approved / all reviews) */
  codexApprovalRate: `(sum(increase(${METRICS.CODEX.GUARDIAN_REVIEW}{${CODEX_BASE_FILTER}, ${LABELS.CODEX_DECISION}="approved"}[$__range])) or vector(0)) / clamp_min(sum(increase(${METRICS.CODEX.GUARDIAN_REVIEW}{${CODEX_BASE_FILTER}}[$__range])) or vector(0), 1) * 100`,

  /** Codex tool-call success rate (successful tool calls / all tool calls) */
  codexToolSuccessRate: `(sum(increase(${METRICS.CODEX.TOOL_CALL}{${CODEX_CONTEXT_FILTER}, ${LABELS.CODEX_SUCCESS}="true"}[$__range])) or vector(0)) / clamp_min(sum(increase(${METRICS.CODEX.TOOL_CALL}{${CODEX_CONTEXT_FILTER}}[$__range])) or vector(0), 1) * 100`,

  /** Codex turn count */
  codexTurnCount: `sum(increase(${METRICS.CODEX.CONVERSATION_TURN}{${CODEX_CONTEXT_FILTER}}[$__range]))`,

  /** Average Codex turn end-to-end duration in milliseconds */
  codexTurnDuration: `(sum(increase(${METRICS.CODEX.TURN_E2E_DURATION_SUM}{${CODEX_CONTEXT_FILTER}}[$__range])) or vector(0)) / clamp_min(sum(increase(${METRICS.CODEX.TURN_E2E_DURATION_COUNT}{${CODEX_CONTEXT_FILTER}}[$__range])) or vector(0), 1)`,

  /** Codex API request count */
  codexApiRequests: `sum(increase(${METRICS.CODEX.API_REQUEST}{${CODEX_CONTEXT_FILTER}}[$__range]))`,

  /** Codex SSE event count */
  codexSseEvents: `sum(increase(${METRICS.CODEX.SSE_EVENT}{${CODEX_CONTEXT_FILTER}}[$__range]))`,

  /** Codex API request count over time */
  codexApiRequestsOverTime: `sum(increase(${METRICS.CODEX.API_REQUEST}{${CODEX_CONTEXT_FILTER}}[$__rate_interval]))`,

  /** Codex SSE event count over time */
  codexSseEventsOverTime: `sum(increase(${METRICS.CODEX.SSE_EVENT}{${CODEX_CONTEXT_FILTER}}[$__rate_interval]))`,
} as const;
