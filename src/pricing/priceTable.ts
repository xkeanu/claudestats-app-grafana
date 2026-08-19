import snapshot from './price-snapshot.json';
import { ResolvedPriceSettings } from './settings';

/** The three per-token rates a model needs before it can be priced at all. */
export interface ModelRates {
  input_cost_per_token: number;
  cache_read_input_token_cost: number;
  output_cost_per_token: number;
}

/**
 * Where the rates in hand actually came from.
 *
 * `fallback` is deliberately distinct from `snapshot`. Both serve the bundled
 * table, but a viewer has to be able to tell "these are August prices because
 * that is what we shipped" from "these are August prices because the refresh
 * was blocked" — one is a considered default, the other is a degraded state.
 */
export type PriceTableSource = 'snapshot' | 'live' | 'fallback';

export interface PriceTable {
  source: PriceTableSource;
  /** Date of the data actually in use — never the build date. */
  asOf: string;
  rates: Record<string, ModelRates>;
}

const RATE_FIELDS: Array<keyof ModelRates> = [
  'input_cost_per_token',
  'cache_read_input_token_cost',
  'output_cost_per_token',
];

const SNAPSHOT_TABLE: PriceTable = {
  source: 'snapshot',
  asOf: snapshot.asOf,
  rates: snapshot.models as Record<string, ModelRates>,
};

/** The bundled table, relabelled as a degraded result rather than a chosen one. */
const FALLBACK_TABLE: PriceTable = { ...SNAPSHOT_TABLE, source: 'fallback' };

/**
 * Fraction of the bundled table a live feed must still price to be trusted.
 *
 * A feed that parses cleanly can still be truncated, half-migrated, or simply
 * the wrong URL. Accepting it would replace the bundled table with a near-empty
 * one, push active models into the unpriced bucket, and understate cost — the
 * "degrade to a wrong number" failure the fallback exists to prevent, and worse
 * than a blocked refresh because it looks successful.
 *
 * Coverage is measured against the bundled table because both come from the
 * same upstream, so it should not collapse between releases. Discard ratio is
 * NOT usable as a signal: 59% of the real feed's openai-provider entries
 * legitimately lack a complete rate triple, so that check would reject the
 * genuine article. Half is deliberately lax — this catches collapse, not the
 * ordinary churn of a few deprecated models.
 */
const MIN_SNAPSHOT_COVERAGE = 0.5;

/**
 * Extracts the usable subset of a LiteLLM-shaped payload.
 *
 * Only `openai`-provider keys are kept — Codex reports bare model ids that
 * match that key set exactly — and only when all three rates are present and
 * numeric. Returns null rather than a thin table when too little survives, so a
 * schema change upstream degrades to the known-good snapshot instead of to a
 * table that silently prices everything at zero.
 */
function parseFeed(payload: unknown): Record<string, ModelRates> | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }

  const rates: Record<string, ModelRates> = {};

  for (const [key, entry] of Object.entries(payload as Record<string, unknown>)) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }

    const candidate = entry as Record<string, unknown>;
    if (candidate.litellm_provider !== 'openai') {
      continue;
    }

    const parsed = {} as ModelRates;
    let complete = true;

    for (const field of RATE_FIELDS) {
      const value = candidate[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        complete = false;
        break;
      }
      parsed[field] = value;
    }

    if (complete) {
      rates[key] = parsed;
    }
  }

  if (Object.keys(rates).length === 0) {
    return null;
  }

  const bundledKeys = Object.keys(SNAPSHOT_TABLE.rates);
  const covered = bundledKeys.filter((key) => rates[key] !== undefined).length;
  if (covered < bundledKeys.length * MIN_SNAPSHOT_COVERAGE) {
    return null;
  }

  return rates;
}

/**
 * A feed may carry its own date. LiteLLM's does not, so this usually falls
 * through to today — but never to the build date, which would misreport live
 * data as being as old as the bundle.
 */
function readAsOf(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const asOf = (payload as Record<string, unknown>).asOf;
    if (typeof asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
      return asOf;
    }
  }
  return new Date().toISOString().slice(0, 10);
}

async function fetchTable(url: string): Promise<PriceTable> {
  try {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) {
      return FALLBACK_TABLE;
    }

    const payload = await response.json();
    const rates = parseFeed(payload);
    if (rates === null) {
      return FALLBACK_TABLE;
    }

    return { source: 'live', asOf: readAsOf(payload), rates };
  } catch {
    // Rejected fetch, non-JSON body, malformed payload — every failure mode
    // lands on the known-good table rather than on a wrong number.
    return FALLBACK_TABLE;
  }
}

/**
 * Memoised per settings key. Cost appears on panels across three views and the
 * upstream feed is ~1.8 MB, so the table is resolved once per session and the
 * in-flight promise — not just the result — is shared, which is what keeps ten
 * panels activating at once down to a single request (REQ-013).
 */
let cacheKey: string | null = null;
let cached: Promise<PriceTable> | null = null;

export function resolvePriceTable(settings: ResolvedPriceSettings): Promise<PriceTable> {
  const key = `${settings.priceRefreshEnabled}|${settings.priceFeedUrl}`;

  if (cacheKey !== key || cached === null) {
    cacheKey = key;
    cached = settings.priceRefreshEnabled
      ? fetchTable(settings.priceFeedUrl)
      : Promise.resolve(SNAPSHOT_TABLE);
  }

  return cached;
}

/** Test seam. Not used in production code. */
export function __resetPriceTableCache(): void {
  cacheKey = null;
  cached = null;
}
