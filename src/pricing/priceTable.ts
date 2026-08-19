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
 * Extracts the usable subset of a LiteLLM-shaped payload.
 *
 * Only `openai`-provider keys are kept — Codex reports bare model ids that
 * match that key set exactly — and only when all three rates are present and
 * numeric. Returns null rather than an empty table when nothing survives, so a
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

  return Object.keys(rates).length === 0 ? null : rates;
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
