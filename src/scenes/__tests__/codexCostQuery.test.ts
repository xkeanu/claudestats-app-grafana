import { QUERIES } from '../queries';
import { CODEX_BILLABLE_TOKEN_TYPES } from '../../constants';

describe('QUERIES.codexTokensByModelAndType', () => {
  const q = QUERIES.codexTokensByModelAndType;

  it('groups by both model and token_type in one result set', () => {
    expect(q).toMatch(/sum by \(model, ?token_type\)/);
  });

  it('reuses the shared Codex context filter rather than declaring its own', () => {
    // CODEX_CONTEXT_FILTER is not exported; assert on the fragments only it carries.
    expect(q).toContain('originator=~"${codex_originator:regex}"');
    expect(q).toContain('session_source=~"${codex_session_source:regex}"');
    expect(q).toContain('os=~"${codex_os:regex}"');
    expect(q).toContain('model=~"${model:regex}"');
  });

  it('restricts the selector to the three billable token types', () => {
    expect(q).toContain('token_type=~"input|cached_input|output"');
  });

  it('excludes token_type="total" from the selector', () => {
    expect(q).not.toContain('token_type="total"');
    expect(CODEX_BILLABLE_TOKEN_TYPES).not.toContain('total');
  });

  it('excludes the subset token types that would double-count', () => {
    // reasoning_output is a subset of output; cache_write_input is always zero.
    expect(CODEX_BILLABLE_TOKEN_TYPES).not.toContain('reasoning_output');
    expect(CODEX_BILLABLE_TOKEN_TYPES).not.toContain('cache_write_input');
    expect(CODEX_BILLABLE_TOKEN_TYPES).not.toContain('non_cached_input');
  });

  it('reads the counter over the dashboard range', () => {
    expect(q).toContain('codex_turn_token_usage_sum');
    expect(q).toContain('[$__range]');
  });
});
