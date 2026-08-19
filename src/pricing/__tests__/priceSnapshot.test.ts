import snapshot from '../price-snapshot.json';

describe('price-snapshot.json', () => {
  it('carries a top-level asOf date in ISO form', () => {
    expect(snapshot.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('names its upstream source', () => {
    expect(snapshot.source).toContain('litellm');
  });

  it('holds the verified gpt-5.3-codex rates', () => {
    // Confirmed against the live feed on 2026-08-19; the plan cites these
    // exact figures, so a silent upstream change must fail the build here.
    expect(snapshot.models['gpt-5.3-codex']).toEqual({
      input_cost_per_token: 1.75e-6,
      cache_read_input_token_cost: 1.75e-7,
      output_cost_per_token: 1.4e-5,
    });
  });

  it('prices every model matched by T1 against the live datasource', () => {
    for (const model of ['gpt-5.6-sol', 'gpt-5.5', 'gpt-5.6-terra', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.6-luna']) {
      expect(snapshot.models[model as keyof typeof snapshot.models]).toBeDefined();
    }
  });

  it('carries a complete rate triple on every entry, all finite and non-negative', () => {
    const entries = Object.entries(snapshot.models);
    expect(entries.length).toBeGreaterThan(0);

    for (const [key, rates] of entries) {
      for (const field of ['input_cost_per_token', 'cache_read_input_token_cost', 'output_cost_per_token'] as const) {
        const value = (rates as Record<string, number>)[field];
        const where = `${key}.${field}`;
        expect([where, typeof value]).toEqual([where, 'number']);
        expect([where, Number.isFinite(value)]).toEqual([where, true]);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('stores keys in sorted order so a refresh diff stays reviewable', () => {
    const keys = Object.keys(snapshot.models);
    expect(keys).toEqual([...keys].sort());
  });
});
