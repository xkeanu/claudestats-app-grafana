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
    changeValueTo = jest.fn();
    subscribers: Array<(state: Record<string, unknown>) => void> = [];

    constructor(initialState: Record<string, unknown>) {
      this.state = initialState;
    }

    subscribeToState(handler: (state: Record<string, unknown>) => void) {
      this.subscribers.push(handler);
      return { unsubscribe: jest.fn() };
    }

    emit(state: Record<string, unknown>) {
      this.state = { ...this.state, ...state };
      this.subscribers.forEach((handler) => handler(this.state));
    }
  },
  SceneVariableSet: class SceneVariableSet {
    state: Record<string, unknown>;
    activationHandlers: Array<() => void> = [];

    constructor(initialState: Record<string, unknown>) {
      this.state = initialState;
    }

    addActivationHandler(handler: () => void) {
      this.activationHandlers.push(handler);
    }

    activate() {
      this.activationHandlers.forEach((handler) => handler());
    }
  },
}));

import { CODING_TOOLS, LABELS, METRICS, MODEL_FAMILIES, OTHER_FAMILY, ROUTES } from '../../constants';
import { getCodingToolVariable, getModelVariable, getProviderVariable, getSharedVariables } from '../variables';
import { PROVIDER_FILTERS, QUERIES, withProviderLabel } from '../queries';

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

  it('gates Codex contributions behind Claude-only shared filters', () => {
    const expectedCodexSharedFilterPrefix = `${LABELS.JOB}=~"\${coding_tool:raw}", ${LABELS.USER_EMAIL}=~"$member", ${LABELS.TERMINAL_TYPE}=~"\${terminal_type:regex}", ${LABELS.OS_TYPE}=~"\${os_type:regex}", ${LABELS.DEVICE}=~"\${device:regex}"`;

    for (const query of [
      QUERIES.totalTokens,
      QUERIES.inputTokens,
      QUERIES.outputTokens,
      QUERIES.cacheReadTokens,
      QUERIES.tokensByType,
      QUERIES.tokensByModel,
      QUERIES.tokensOverTime,
      QUERIES.totalSessions,
      QUERIES.avgTokensPerSession,
      QUERIES.sessionsByModel,
      QUERIES.toolDecisions,
      QUERIES.toolDecisionsByTool,
      QUERIES.toolAcceptanceRate,
      QUERIES.toolDecisionsOverTime,
    ]) {
      expect(query).toContain(`{${expectedCodexSharedFilterPrefix}`);
    }
  });

  it('applies Codex-specific filters to guardian review queries', () => {
    const codexSpecificFilters = [
      `${LABELS.MODEL}=~"\${model:regex}"`,
      `${LABELS.CODEX_ORIGINATOR}=~"\${codex_originator:regex}"`,
      `${LABELS.CODEX_SESSION_SOURCE}=~"\${codex_session_source:regex}"`,
      `${LABELS.CODEX_OS}=~"\${codex_os:regex}"`,
    ];

    for (const query of [
      QUERIES.codexApprovalRate,
      QUERIES.toolDecisions,
      QUERIES.toolAcceptanceRate,
      QUERIES.toolDecisionsOverTime,
    ]) {
      for (const labelFilter of codexSpecificFilters) {
        expect(query).toContain(labelFilter);
      }
    }
  });

  it('exposes the Codex route for navigation', () => {
    expect(ROUTES.Codex).toBe('codex');
  });
});

describe('provider family rule table', () => {
  it('exposes a provider label name', () => {
    expect(LABELS.PROVIDER).toBe('provider');
  });

  it('defines the four named families in order with distinct displays', () => {
    expect(MODEL_FAMILIES.map((family) => family.key)).toEqual(['claude', 'gpt', 'glm', 'review']);

    const displays = MODEL_FAMILIES.map((family) => family.display);
    expect(new Set(displays).size).toBe(displays.length);

    for (const family of MODEL_FAMILIES) {
      expect(typeof family.match).toBe('string');
      expect(family.match.length).toBeGreaterThan(0);
    }
  });

  it('uses an unanchored claude rule so anthropic/claude-* is not misfiled', () => {
    const claude = MODEL_FAMILIES.find((family) => family.key === 'claude');

    expect(claude?.match).toBe('.*claude.*');
    // Prometheus regexes are fully anchored; prove the rule survives that.
    expect(new RegExp(`^(?:${claude?.match})$`).test('anthropic/claude-sonnet-4.6')).toBe(true);
  });

  it('defines a catch-all family carrying no match fragment', () => {
    expect(OTHER_FAMILY.display).toBe('Other');
    expect('match' in OTHER_FAMILY).toBe(false);
  });
});

describe('provider derivation helpers', () => {
  /** Prometheus regexes are fully anchored; mirror that when testing a fragment. */
  const anchored = (fragment: string) => new RegExp(`^(?:${fragment})$`);

  it('wraps an expression in a label_replace chain, one call per family plus the catch-all', () => {
    const wrapped = withProviderLabel('sum(up)');

    expect(wrapped).toContain('sum(up)');
    expect(wrapped.match(/label_replace\(/g)).toHaveLength(MODEL_FAMILIES.length + 1);
  });

  it('emits the catch-all innermost and the named rules outside it in table order', () => {
    const wrapped = withProviderLabel('sum(up)');

    // Nesting is left-to-right in the emitted string: the innermost call is
    // written first. Inverting the chain would classify everything as Other.
    const positions = [OTHER_FAMILY.display, ...MODEL_FAMILIES.map((family) => family.display)].map(
      (display) => wrapped.indexOf(`"${LABELS.PROVIDER}", "${display}"`)
    );

    expect(positions).not.toContain(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('anchors the claude rule wide enough for prefixed and suffixed model names', () => {
    const claude = MODEL_FAMILIES.find((family) => family.key === 'claude')!;

    expect(anchored(claude.match).test('anthropic/claude-sonnet-4.6')).toBe(true);
    expect(anchored(claude.match).test('claude-opus-5[1m]')).toBe(true);
    // The reason the rule is not a bare prefix: it would drop the vendor-prefixed values.
    expect(anchored('claude.*').test('anthropic/claude-sonnet-4.6')).toBe(false);
  });

  it('exposes a filter fragment per family plus All and the catch-all', () => {
    expect(Object.keys(PROVIDER_FILTERS).sort()).toEqual(
      ['All', ...MODEL_FAMILIES.map((family) => family.display), OTHER_FAMILY.display].sort()
    );

    for (const family of MODEL_FAMILIES) {
      expect(PROVIDER_FILTERS[family.display]).toBe(`${LABELS.MODEL}=~"${family.match}"`);
    }
  });

  it('negates every named rule in the catch-all filter, since RE2 has no lookahead', () => {
    const catchAll = PROVIDER_FILTERS[OTHER_FAMILY.display];

    expect(catchAll).toContain(`${LABELS.MODEL}!~"`);
    expect(catchAll).not.toContain(`${LABELS.MODEL}=~"`);

    const alternation = catchAll.slice(catchAll.indexOf('"') + 1, catchAll.lastIndexOf('"'));
    expect(alternation.split('|')).toEqual(MODEL_FAMILIES.map((family) => family.match));

    // A model matching no named rule is the only thing the fragment admits.
    expect(anchored(alternation).test('some-unknown-model')).toBe(false);
    expect(anchored(alternation).test('glm-4.7')).toBe(true);
  });

  it('derives both helpers from the rule table, so a fifth family needs no edit here', () => {
    jest.isolateModules(() => {
      const actual = jest.requireActual('../../constants');
      jest.doMock('../../constants', () => ({
        ...actual,
        MODEL_FAMILIES: [...actual.MODEL_FAMILIES, { key: 'llama', display: 'Llama', match: 'llama.*' }],
      }));

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const patched = require('../queries');

      expect(patched.withProviderLabel('sum(up)')).toContain(`"${LABELS.PROVIDER}", "Llama"`);
      expect(patched.withProviderLabel('sum(up)').match(/label_replace\(/g)).toHaveLength(
        MODEL_FAMILIES.length + 2
      );
      expect(patched.PROVIDER_FILTERS.Llama).toBe(`${LABELS.MODEL}=~"llama.*"`);
      expect(patched.PROVIDER_FILTERS[OTHER_FAMILY.display]).toContain('llama.*');
    });
  });
});

describe('provider variable', () => {
  it('offers All plus one option per family, valued by matcher fragment', () => {
    const variable = getProviderVariable();

    expect(variable.state.name).toBe('provider');
    expect(variable.state.includeAll).toBe(true);
    expect(variable.state.defaultToAll).toBe(true);
    expect(variable.state.allValue).toBe(PROVIDER_FILTERS.All);

    const query = variable.state.query as string;
    for (const display of [...MODEL_FAMILIES.map((family) => family.display), OTHER_FAMILY.display]) {
      expect(query).toContain(`${display} : ${PROVIDER_FILTERS[display]}`);
    }
    expect(query.split(',')).toHaveLength(MODEL_FAMILIES.length + 1);
    // The catch-all option must carry the negated matcher, not a positive one.
    expect(query).toContain(`${OTHER_FAMILY.display} : ${LABELS.MODEL}!~"`);
  });

  it('places provider before model so the filter bar reads in cascade order', () => {
    const names = (getSharedVariables().state.variables as Array<{ state: { name: string } }>).map(
      (variable) => variable.state.name
    );

    expect(names).toContain('provider');
    expect(names.indexOf('provider')).toBeLessThan(names.indexOf('model'));
  });
});

describe('provider filter application', () => {
  it('scopes every model-aware query by provider', () => {
    const modelAware = Object.entries(QUERIES).filter(([, query]) => query.includes(LABELS.MODEL));

    // Sanity: the filter would be vacuous if nothing referenced model at all.
    expect(modelAware.length).toBeGreaterThan(0);

    for (const [name, query] of modelAware) {
      expect([name, query.includes(LABELS.PROVIDER)]).toEqual([name, true]);
    }
  });

  it('scopes the group-by-model panels that carry no model filter', () => {
    for (const query of [QUERIES.costByModel, QUERIES.tokensByModel, QUERIES.sessionsByModel]) {
      expect(query).toContain('${provider:raw}');
    }
  });

  it('keeps the cost table grouped by raw model while still filtering by provider', () => {
    expect(QUERIES.costTableByDevice).toContain(`sum by (${LABELS.DEVICE}, ${LABELS.MODEL})`);
    expect(QUERIES.costTableByDevice).toContain('${provider:raw}');
  });

  it('leaves queries over metrics with no model dimension untouched', () => {
    for (const query of [
      QUERIES.totalLinesOfCode,
      QUERIES.totalCommits,
      QUERIES.totalPullRequests,
      QUERIES.toolDecisionsByLanguage,
      QUERIES.usageByOsType,
    ]) {
      expect(query).not.toContain(LABELS.PROVIDER);
    }
  });
});

describe('model cascade reset', () => {
  const activatedSet = () => {
    const set = getSharedVariables() as unknown as {
      activate: () => void;
      state: { variables: Array<{ state: { name: string } }> };
    };
    set.activate();

    const model = set.state.variables.find((variable) => variable.state.name === 'model');
    return { set, model: model as unknown as ModelVariableMock };
  };

  interface ModelVariableMock {
    emit: (state: Record<string, unknown>) => void;
    changeValueTo: jest.Mock;
  }

  it('narrows the model query by the selected provider', () => {
    const query = (getModelVariable().state.query as unknown as { query: string }).query;

    expect(query).toContain('${provider:raw}');
    expect(query).toContain(`, ${LABELS.MODEL})`);
  });

  it('resets a model excluded by the newly selected provider back to All', () => {
    const { model } = activatedSet();

    // Provider switched to Claude: the option list refreshed, glm-4.7 did not survive it.
    model.emit({
      loading: false,
      value: 'glm-4.7',
      options: [{ value: 'claude-opus-5', label: 'claude-opus-5' }],
    });

    expect(model.changeValueTo).toHaveBeenCalledWith('$__all', 'All');
  });

  it('leaves a model that the new provider still includes alone', () => {
    const { model } = activatedSet();

    model.emit({
      loading: false,
      value: 'claude-opus-5',
      options: [{ value: 'claude-opus-5', label: 'claude-opus-5' }],
    });

    expect(model.changeValueTo).not.toHaveBeenCalled();
  });

  it('does not reset while the option list is still loading or already All', () => {
    const { model } = activatedSet();

    model.emit({ loading: true, value: 'glm-4.7', options: [] });
    model.emit({ loading: false, value: '$__all', options: [{ value: 'claude-opus-5', label: 'x' }] });

    expect(model.changeValueTo).not.toHaveBeenCalled();
  });
});

describe('provider-grouped panels', () => {
  const regrouped = ['costByModel', 'costOverTime', 'tokensByModel', 'sessionsByModel'] as const;

  it('aggregates the four by-model panels on provider', () => {
    for (const name of regrouped) {
      const query = QUERIES[name];

      expect([name, query.includes(`sum by (${LABELS.PROVIDER})`)]).toEqual([name, true]);
      expect([name, query.includes('label_replace(')]).toEqual([name, true]);
      // The chain must be present in full, not a hand-written partial.
      expect([name, (query.match(/label_replace\(/g) ?? []).length]).toEqual([
        name,
        MODEL_FAMILIES.length + 1,
      ]);
    }
  });

  it('caps each re-grouped panel at the four families plus the catch-all', () => {
    for (const name of regrouped) {
      const assigned = [...QUERIES[name].matchAll(/"provider", "([^"]+)"/g)].map((match) => match[1]);

      expect([name, new Set(assigned).size]).toEqual([name, MODEL_FAMILIES.length + 1]);
    }
  });

  it('leaves the cost table grouped by raw model', () => {
    expect(QUERIES.costTableByDevice).toContain(`sum by (${LABELS.DEVICE}, ${LABELS.MODEL})`);
    expect(QUERIES.costTableByDevice).not.toContain('label_replace(');
  });
});
