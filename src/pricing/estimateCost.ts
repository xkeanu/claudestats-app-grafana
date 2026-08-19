import { ModelRates, PriceTable } from './priceTable';

/** One `(model, token_type)` cell of the Codex token query. */
export interface TokenRow {
  model: string;
  token_type: string;
  tokens: number;
}

export interface CostEstimate {
  estimatedCostUsd: number;
  /** Billable tokens belonging to models the table cannot price. */
  unpricedTokens: number;
  /** Those models, deduplicated and sorted, so an understated total is visibly understated. */
  unpricedModels: string[];
}

interface ModelTotals {
  input: number;
  cached_input: number;
  output: number;
}

const EMPTY_TOTALS = (): ModelTotals => ({ input: 0, cached_input: 0, output: 0 });

/**
 * A model is priced only when all three rates are present and numeric. A
 * partial entry is treated exactly like an absent one — no substitute rate, no
 * special case, no invented number (REQ-004).
 */
function completeRates(rates: ModelRates | undefined): ModelRates | null {
  if (rates === undefined) {
    return null;
  }

  for (const field of ['input_cost_per_token', 'cache_read_input_token_cost', 'output_cost_per_token'] as const) {
    const value = rates[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
  }

  return rates;
}

/**
 * Applies a price table to Codex token counts.
 *
 * Pure and side-effect free, because this is the one place where a silent
 * arithmetic error would corrupt every panel downstream.
 *
 * Two things the shape of the data makes easy to get wrong:
 *
 * 1. `input` is GROSS — it already contains `cached_input` (~95% of it on real
 *    data). Fresh input is therefore `max(0, input - cached_input)`. Charging
 *    `input` at the input rate AND `cached_input` at the cache-read rate bills
 *    most tokens twice and overstates cost by roughly 7x.
 * 2. Only `input`, `cached_input` and `output` are billable. `total` is the sum
 *    of input and output; `reasoning_output` is a subset of output;
 *    `cache_write_input` is always zero; `non_cached_input` never appears. Any
 *    of them entering the arithmetic double-counts.
 *
 * Verified against the live datasource — see
 * docs/research/2026-06-27-telemetry/03-real-data-inventory.md section 6.
 */
export function estimateCost(rows: TokenRow[], table: PriceTable): CostEstimate {
  const perModel = new Map<string, ModelTotals>();

  for (const row of rows) {
    if (typeof row.tokens !== 'number' || !Number.isFinite(row.tokens)) {
      continue;
    }

    // Anything not one of the three billable types is dropped here, before it
    // can reach the arithmetic.
    if (row.token_type !== 'input' && row.token_type !== 'cached_input' && row.token_type !== 'output') {
      continue;
    }

    const totals = perModel.get(row.model) ?? EMPTY_TOTALS();
    totals[row.token_type] += row.tokens;
    perModel.set(row.model, totals);
  }

  let estimatedCostUsd = 0;
  let unpricedTokens = 0;
  const unpricedModels: string[] = [];

  for (const [model, totals] of perModel) {
    // Clamped: a scrape race can momentarily report cached above gross input,
    // and a negative fresh count would produce negative cost.
    const freshInput = Math.max(0, totals.input - totals.cached_input);
    const billable = freshInput + totals.cached_input + totals.output;

    // Exact string match — T1's rule. No prefix strip, no normalization.
    const rates = completeRates(table.rates[model]);

    if (rates === null) {
      unpricedTokens += billable;
      unpricedModels.push(model);
      continue;
    }

    estimatedCostUsd +=
      freshInput * rates.input_cost_per_token +
      totals.cached_input * rates.cache_read_input_token_cost +
      totals.output * rates.output_cost_per_token;
  }

  return { estimatedCostUsd, unpricedTokens, unpricedModels: unpricedModels.sort() };
}
