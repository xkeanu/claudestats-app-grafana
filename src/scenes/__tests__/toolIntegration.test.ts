jest.mock('@grafana/scenes', () => ({
  CustomVariable: class CustomVariable {
    state: Record<string, unknown>;

    constructor(initialState: Record<string, unknown>) {
      this.state = initialState;
    }
  },
  DataSourceVariable: class DataSourceVariable {
    state: Record<string, unknown>;

    constructor(initialState: Record<string, unknown>) {
      this.state = initialState;
    }
  },
  QueryVariable: class QueryVariable {
    state: Record<string, unknown>;

    constructor(initialState: Record<string, unknown>) {
      this.state = initialState;
    }
  },
  SceneVariableSet: class SceneVariableSet {
    state: Record<string, unknown>;

    constructor(initialState: Record<string, unknown>) {
      this.state = initialState;
    }
  },
}));

import { CODING_TOOLS, LABELS, METRICS, ROUTES } from '../../constants';
import { getCodingToolVariable } from '../variables';
import { QUERIES } from '../queries';

describe('coding tool integration contracts', () => {
  it('defines provider-neutral labels without reusing decision source', () => {
    expect(LABELS.JOB).toBe('job');
    expect(LABELS.CODEX_ORIGINATOR).toBe('originator');
    expect(LABELS.CODEX_SESSION_SOURCE).toBe('session_source');
    expect(LABELS.CODEX_TOKEN_TYPE).toBe('token_type');
    expect(LABELS.CODEX_DECISION).toBe('decision');
    expect(LABELS.CODEX_SUCCESS).toBe('success');
  });

  it('defines documented Codex metrics separately from Claude Code metrics', () => {
    expect(METRICS.CLAUDE_CODE.TOKEN_USAGE).toBe('claude_code_token_usage_tokens_total');
    expect(METRICS.CODEX.TURN_TOKEN_USAGE).toBe('codex_turn_token_usage_sum');
    expect(METRICS.CODEX.TOOL_CALL).toBe('codex_tool_call_total');
    // Codex's approval analog is the guardian auto-review metric, not a
    // (nonexistent) approval_requested counter.
    expect(METRICS.CODEX.GUARDIAN_REVIEW).toBe('codex_guardian_review_total');
    // Session analog: thread_started (a conversation turn is not a session).
    expect(METRICS.CODEX.THREAD_STARTED).toBe('codex_thread_started_total');
    expect(METRICS.CODEX.CONVERSATION_TURN).toBe('codex_conversation_turn_count_total');
    expect(METRICS.CODEX.TURN_E2E_DURATION_SUM).toBe('codex_turn_e2e_duration_ms_milliseconds_sum');
    expect(METRICS.CODEX.TURN_E2E_DURATION_COUNT).toBe('codex_turn_e2e_duration_ms_milliseconds_count');
  });

  it('exposes a custom coding tool selector with Claude Code and Codex options', () => {
    const variable = getCodingToolVariable();

    expect(variable.state.name).toBe('coding_tool');
    expect(variable.state.label).toBe('Coding Tool');
    expect(variable.state.includeAll).toBe(true);
    expect(variable.state.defaultToAll).toBe(true);
    expect(variable.state.allValue).toBe('.*');
    expect(variable.state.query).toContain(`Claude Code : ${CODING_TOOLS.CLAUDE_CODE}`);
    expect(variable.state.query).toContain(`Codex : ${CODING_TOOLS.CODEX}`);
    expect(CODING_TOOLS.CLAUDE_CODE).toContain('claude');
    expect(CODING_TOOLS.CODEX).toContain('codex');
  });

  it('keeps Claude Code-only metric families explicit', () => {
    expect(QUERIES.totalCost).toContain(METRICS.CLAUDE_CODE.COST_USAGE);
    expect(QUERIES.totalLinesOfCode).toContain(METRICS.CLAUDE_CODE.LINES_OF_CODE);
    expect(QUERIES.totalCost).not.toContain(METRICS.CODEX.TURN_TOKEN_USAGE);
  });

  it('routes the coding tool selector through real exporter labels', () => {
    expect(QUERIES.totalCost).toContain(`${LABELS.JOB}=~"\${coding_tool:raw}"`);
    expect(QUERIES.codexTotalTokens).toContain(`${LABELS.JOB}=~"\${coding_tool:raw}"`);
    expect(QUERIES.codexTotalTokens).not.toContain('coding_tool=~"$coding_tool"');
    expect(QUERIES.codexTotalTokens).not.toContain('client=~"$client"');
    expect(QUERIES.codexTotalTokens).not.toContain('surface=~"$surface"');
  });

  it('adds Codex query coverage for comparable usage metrics', () => {
    expect(QUERIES.codexTotalTokens).toContain(METRICS.CODEX.TURN_TOKEN_USAGE);
    expect(QUERIES.codexTokensByType).toContain(`by (${LABELS.CODEX_TOKEN_TYPE})`);
    expect(QUERIES.codexToolCallsByTool).toContain(METRICS.CODEX.TOOL_CALL);
    expect(QUERIES.codexToolCallsByTool).toContain(`by (${LABELS.CODEX_TOOL})`);
    expect(QUERIES.codexApprovalRate).toContain(METRICS.CODEX.GUARDIAN_REVIEW);
    expect(QUERIES.codexApprovalRate).toContain(`${LABELS.CODEX_DECISION}="approved"`);
    expect(QUERIES.codexToolSuccessRate).toContain(METRICS.CODEX.TOOL_CALL);
    expect(QUERIES.codexToolSuccessRate).toContain(`${LABELS.CODEX_SUCCESS}="true"`);
    expect(QUERIES.codexTurnDuration).toContain(METRICS.CODEX.TURN_E2E_DURATION_SUM);
    expect(QUERIES.codexTurnDuration).toContain(METRICS.CODEX.TURN_E2E_DURATION_COUNT);
    expect(QUERIES.codexApiRequestsOverTime).toContain('$__rate_interval');
    expect(QUERIES.codexSseEventsOverTime).toContain('$__rate_interval');
  });

  it('adds shared-page Codex aggregations for tokens, tools, sessions, and environment', () => {
    expect(QUERIES.totalTokens).toContain(METRICS.CLAUDE_CODE.TOKEN_USAGE);
    expect(QUERIES.totalTokens).toContain(METRICS.CODEX.TURN_TOKEN_USAGE);
    expect(QUERIES.inputTokens).toContain(`${LABELS.CODEX_TOKEN_TYPE}="input"`);
    expect(QUERIES.cacheReadTokens).toContain(`${LABELS.CODEX_TOKEN_TYPE}="cached_input"`);
    expect(QUERIES.toolDecisions).toContain(METRICS.CODEX.GUARDIAN_REVIEW);
    expect(QUERIES.toolDecisionsByTool).toContain(METRICS.CODEX.TOOL_CALL);
    expect(QUERIES.totalSessions).toContain(METRICS.CODEX.THREAD_STARTED);
    expect(QUERIES.codexUsageByOs).toContain(LABELS.CODEX_OS);
    expect(QUERIES.codexUsageByOriginator).toContain(LABELS.CODEX_ORIGINATOR);
    expect(QUERIES.codexUsageBySessionSource).toContain(LABELS.CODEX_SESSION_SOURCE);
    expect(QUERIES.codexUsageByAppVersion).toContain(LABELS.CODEX_APP_VERSION);
  });

  it('exposes the Codex route for navigation', () => {
    expect(ROUTES.Codex).toBe('codex');
  });
});
