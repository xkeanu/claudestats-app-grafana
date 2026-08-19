import { estimateCost, TokenRow } from '../estimateCost';
import { ModelRates, PriceTable } from '../priceTable';

/** The verified August 2026 gpt-5.3-codex rates. */
const CODEX_RATES: ModelRates = {
  input_cost_per_token: 1.75e-6,
  cache_read_input_token_cost: 1.75e-7,
  output_cost_per_token: 1.4e-5,
};

const table = (rates: Record<string, Partial<ModelRates>>): PriceTable => ({
  source: 'snapshot',
  asOf: '2026-08-19',
  rates: rates as Record<string, ModelRates>,
});

const rows = (model: string, counts: Record<string, number>): TokenRow[] =>
  Object.entries(counts).map(([token_type, tokens]) => ({ model, token_type, tokens }));

describe('estimateCost', () => {
  it('returns zero cost and an empty unpriced bucket for an empty row set', () => {
    expect(estimateCost([], table({ 'gpt-5.3-codex': CODEX_RATES }))).toEqual({
      estimatedCostUsd: 0,
      unpricedTokens: 0,
      unpricedModels: [],
    });
  });

  it('matches a hand-computed figure at the verified gpt-5.3-codex rates', () => {
    // input is GROSS and contains cached_input, so fresh input = 1,000,000 - 800,000.
    //   fresh   200,000 x 1.75e-6 = 0.35
    //   cached  800,000 x 1.75e-7 = 0.14
    //   output   50,000 x 1.4e-5  = 0.70
    //                              ------
    //                                1.19
    const result = estimateCost(
      rows('gpt-5.3-codex', { input: 1_000_000, cached_input: 800_000, output: 50_000 }),
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );

    expect(result.estimatedCostUsd).toBeCloseTo(1.19, 10);
    expect(result.unpricedTokens).toBe(0);
    expect(result.unpricedModels).toEqual([]);
  });

  it('does not let token_type="total" contribute to the cost', () => {
    const withTotal = estimateCost(
      rows('gpt-5.3-codex', { input: 1_000_000, cached_input: 800_000, output: 50_000, total: 1_050_000 }),
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );

    expect(withTotal.estimatedCostUsd).toBeCloseTo(1.19, 10);
  });

  it('does not let the subset token types contribute to the cost', () => {
    // reasoning_output is a subset of output, cache_write_input is always zero,
    // and non_cached_input is absent from the metric. Any of them entering the
    // arithmetic would double-count.
    const withSubsets = estimateCost(
      rows('gpt-5.3-codex', {
        input: 1_000_000,
        cached_input: 800_000,
        output: 50_000,
        reasoning_output: 20_000,
        cache_write_input: 999,
        non_cached_input: 200_000,
      }),
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );

    expect(withSubsets.estimatedCostUsd).toBeCloseTo(1.19, 10);
  });

  it('charges cached input at the cache-read rate, never also at the input rate', () => {
    const cacheHeavy = estimateCost(
      rows('gpt-5.3-codex', { input: 1_000_000, cached_input: 950_000, output: 0 }),
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );
    const noCache = estimateCost(
      rows('gpt-5.3-codex', { input: 1_000_000, cached_input: 0, output: 0 }),
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );

    //   cache-heavy: 50,000 x 1.75e-6 + 950,000 x 1.75e-7 = 0.0875 + 0.16625
    //   no cache:  1,000,000 x 1.75e-6                    = 1.75
    expect(cacheHeavy.estimatedCostUsd).toBeCloseTo(0.25375, 10);
    expect(noCache.estimatedCostUsd).toBeCloseTo(1.75, 10);
    expect(cacheHeavy.estimatedCostUsd).toBeLessThan(noCache.estimatedCostUsd);
  });

  it('never bills the same gross input twice', () => {
    // The regression this whole module exists to prevent: charging `input` at
    // the input rate AND `cached_input` at the cache-read rate would give
    // 1.75 + 0.16625 here instead of 0.25375.
    const result = estimateCost(
      rows('gpt-5.3-codex', { input: 1_000_000, cached_input: 950_000, output: 0 }),
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );

    expect(result.estimatedCostUsd).toBeLessThan(1.75);
  });

  it('clamps fresh input at zero when cached exceeds gross input', () => {
    // Scrape races can momentarily report cached_input above input; a negative
    // fresh count would produce negative cost.
    const result = estimateCost(
      rows('gpt-5.3-codex', { input: 100, cached_input: 500, output: 0 }),
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );

    expect(result.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    expect(result.estimatedCostUsd).toBeCloseTo(500 * 1.75e-7, 12);
  });

  it('buckets a model absent from the table as unpriced, contributing nothing to cost', () => {
    const result = estimateCost(
      rows('codex-auto-review', { input: 1_000_000, cached_input: 800_000, output: 50_000 }),
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );

    expect(result.estimatedCostUsd).toBe(0);
    // Billable volume: fresh 200,000 + cached 800,000 + output 50,000.
    expect(result.unpricedTokens).toBe(1_050_000);
    expect(result.unpricedModels).toEqual(['codex-auto-review']);
  });

  it('treats a model missing any one of the three rates exactly like an absent one', () => {
    for (const omitted of ['input_cost_per_token', 'cache_read_input_token_cost', 'output_cost_per_token'] as const) {
      const partial: Partial<ModelRates> = { ...CODEX_RATES };
      delete partial[omitted];

      const result = estimateCost(
        rows('gpt-5.3-codex', { input: 1_000_000, cached_input: 800_000, output: 50_000 }),
        table({ 'gpt-5.3-codex': partial })
      );

      expect(result.estimatedCostUsd).toBe(0);
      expect(result.unpricedTokens).toBe(1_050_000);
      expect(result.unpricedModels).toEqual(['gpt-5.3-codex']);
    }
  });

  it('matches models by exact string, applying no normalization', () => {
    // T1's rule. gpt-5.3-codex-spark must not borrow gpt-5.3-codex's rates.
    const result = estimateCost(
      rows('gpt-5.3-codex-spark', { input: 1000, cached_input: 0, output: 0 }),
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );

    expect(result.estimatedCostUsd).toBe(0);
    expect(result.unpricedModels).toEqual(['gpt-5.3-codex-spark']);
  });

  it('sums priced models and buckets unpriced ones in the same pass', () => {
    const result = estimateCost(
      [
        ...rows('gpt-5.3-codex', { input: 1_000_000, cached_input: 800_000, output: 50_000 }),
        ...rows('codex-auto-review', { input: 400_000, cached_input: 300_000, output: 1_000 }),
      ],
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );

    expect(result.estimatedCostUsd).toBeCloseTo(1.19, 10);
    expect(result.unpricedTokens).toBe(401_000);
    expect(result.unpricedModels).toEqual(['codex-auto-review']);
  });

  it('reports each unpriced model once, in a stable order', () => {
    const result = estimateCost(
      [
        ...rows('zzz-unknown', { input: 10, output: 1 }),
        ...rows('aaa-unknown', { input: 10, output: 1 }),
        ...rows('zzz-unknown', { cached_input: 5 }),
      ],
      table({})
    );

    expect(result.unpricedModels).toEqual(['aaa-unknown', 'zzz-unknown']);
  });

  it('ignores rows carrying no usable token count', () => {
    const result = estimateCost(
      [
        { model: 'gpt-5.3-codex', token_type: 'input', tokens: Number.NaN },
        { model: 'gpt-5.3-codex', token_type: 'output', tokens: 50_000 },
      ],
      table({ 'gpt-5.3-codex': CODEX_RATES })
    );

    expect(result.estimatedCostUsd).toBeCloseTo(0.7, 10);
  });
});
