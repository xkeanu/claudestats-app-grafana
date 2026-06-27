export const PLUGIN_ID = 'timurdigital-claudestats-app';
export const PLUGIN_BASE_URL = `/a/${PLUGIN_ID}`;

// Route paths
export const ROUTES = {
  Overview: '',
  Costs: 'costs',
  Tokens: 'tokens',
  Tools: 'tools',
  Codex: 'codex',
  Productivity: 'productivity',
  Sessions: 'sessions',
  Languages: 'languages',
  Environment: 'environment',
} as const;

// Claude Code and Codex OpenTelemetry metric names
// Note: OTEL collector adds units to metric names (e.g., _USD_total, _tokens_total)
export const METRICS = {
  CLAUDE_CODE: {
    SESSION_COUNT: 'claude_code_session_count_total',
    LINES_OF_CODE: 'claude_code_lines_of_code_count_total',
    PULL_REQUESTS: 'claude_code_pull_request_count_total',
    COMMITS: 'claude_code_commit_count_total',
    COST_USAGE: 'claude_code_cost_usage_USD_total',
    TOKEN_USAGE: 'claude_code_token_usage_tokens_total',
    TOOL_DECISION: 'claude_code_code_edit_tool_decision_total',
    ACTIVE_TIME: 'claude_code_active_time_seconds_total',
  },
  CODEX: {
    TURN_TOKEN_USAGE: 'codex_turn_token_usage_sum',
    TOOL_CALL: 'codex_tool_call_total',
    // Codex's auto-review/guardian feature is the real analog to Claude's
    // tool accept/reject. Label `decision` = approved | denied.
    GUARDIAN_REVIEW: 'codex_guardian_review_total',
    // Session-equivalent. A "turn" is one user turn, NOT a session, so the
    // conversation-turn counter overcounts sessions; thread_started is the
    // correct session analog.
    THREAD_STARTED: 'codex_thread_started_total',
    CONVERSATION_TURN: 'codex_conversation_turn_count_total',
    TURN_E2E_DURATION_SUM: 'codex_turn_e2e_duration_ms_milliseconds_sum',
    TURN_E2E_DURATION_COUNT: 'codex_turn_e2e_duration_ms_milliseconds_count',
    API_REQUEST: 'codex_api_request_total',
    SSE_EVENT: 'codex_sse_event_total',
  },
  SESSION_COUNT: 'claude_code_session_count_total',
  LINES_OF_CODE: 'claude_code_lines_of_code_count_total',
  PULL_REQUESTS: 'claude_code_pull_request_count_total',
  COMMITS: 'claude_code_commit_count_total',
  COST_USAGE: 'claude_code_cost_usage_USD_total',
  TOKEN_USAGE: 'claude_code_token_usage_tokens_total',
  TOOL_DECISION: 'claude_code_code_edit_tool_decision_total',
  ACTIVE_TIME: 'claude_code_active_time_seconds_total',
} as const;

export const CODING_TOOLS = {
  CLAUDE_CODE: 'claude-code.*',
  CODEX: 'codex.*',
} as const;

// Label names from OTEL
export const LABELS = {
  USER_EMAIL: 'user_email',
  JOB: 'job',
  MODEL: 'model',
  TOKEN_TYPE: 'type', // input, output, cacheRead, cacheCreation
  LOC_TYPE: 'type', // added, removed
  SESSION_ID: 'session_id',
  TOOL: 'tool_name',
  DECISION: 'decision',
  // Environment labels
  OS_TYPE: 'os_type',
  OS_VERSION: 'os_version',
  HOST_ARCH: 'host_arch',
  SERVICE_VERSION: 'service_version',
  TERMINAL_TYPE: 'terminal_type',
  LANGUAGE: 'language',
  DECISION_SOURCE: 'source',
  ACTIVE_TIME_TYPE: 'type', // user (keyboard), cli (tool execution/AI)
  DEVICE: 'device', // custom resource attribute via OTEL_RESOURCE_ATTRIBUTES="device=my-macbook"
  CODEX_ORIGINATOR: 'originator',
  CODEX_SESSION_SOURCE: 'session_source',
  CODEX_OS: 'os',
  CODEX_APP_VERSION: 'app_version',
  CODEX_TOKEN_TYPE: 'token_type',
  CODEX_TOOL: 'tool',
  CODEX_DECISION: 'decision', // guardian review: approved | denied
  CODEX_SUCCESS: 'success', // tool call / api request: "true" | "false"
} as const;

// Default time ranges
export const TIME_RANGES = {
  LAST_HOUR: 'now-1h',
  LAST_24H: 'now-24h',
  LAST_7D: 'now-7d',
  LAST_30D: 'now-30d',
} as const;

// Panel sizes
export const PANEL_HEIGHTS = {
  STAT: 100,
  MEDIUM: 200,
  LARGE: 300,
  TABLE: 250,
} as const;
