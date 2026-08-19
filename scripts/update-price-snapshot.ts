/**
 * Regenerates `src/pricing/price-snapshot.json` from LiteLLM's public price feed.
 *
 * This is a MAINTENANCE TOOL run by hand, not a build step. `npm run build`
 * must never invoke it: the bundle stays reproducible and offline, and a price
 * change arrives as a reviewable diff in a pull request rather than as a silent
 * shift in yesterday's dashboard.
 *
 *   npm run update-prices
 *   npm run update-prices -- --as-of 2026-08-19   # pin the date, for reruns
 *
 * Output is deterministic: keys are sorted and the JSON is emitted with fixed
 * formatting, so re-running against unchanged upstream data produces a
 * byte-identical file apart from `asOf`.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const FEED_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const OUT_PATH = resolve(__dirname, '../src/pricing/price-snapshot.json');

/** The three rates a model needs before it can be priced at all. */
const RATE_FIELDS = ['input_cost_per_token', 'cache_read_input_token_cost', 'output_cost_per_token'] as const;

type RateField = (typeof RATE_FIELDS)[number];
type Rates = Record<RateField, number>;

interface FeedEntry {
  litellm_provider?: string;
  input_cost_per_token?: unknown;
  cache_read_input_token_cost?: unknown;
  output_cost_per_token?: unknown;
}

/**
 * Only OpenAI-provider keys are kept. Codex reports bare model ids
 * (`gpt-5.6-sol`), which T1 confirmed match the OpenAI-provider key set
 * exactly; the `azure/`, `chatgpt/`, `openrouter/` and friends never match and
 * would only add weight and ambiguity.
 */
function isOpenAiEntry(entry: unknown): entry is FeedEntry {
  return typeof entry === 'object' && entry !== null && (entry as FeedEntry).litellm_provider === 'openai';
}

/**
 * A model is included only when ALL THREE rates are present and numeric.
 * A partial entry is unpriceable under REQ-004 anyway, so carrying it here
 * would overstate the table's coverage without changing any dollar figure.
 */
function completeRates(entry: FeedEntry): Rates | null {
  const rates = {} as Rates;

  for (const field of RATE_FIELDS) {
    const value = entry[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return null;
    }
    rates[field] = value;
  }

  return rates;
}

function parseAsOf(argv: string[]): string {
  const flagIndex = argv.indexOf('--as-of');
  if (flagIndex !== -1) {
    const value = argv[flagIndex + 1];
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error('--as-of expects a YYYY-MM-DD date');
    }
    return value;
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Emits the object with sorted keys and fixed formatting. `JSON.stringify`
 * preserves insertion order for string keys, so sorting on the way in is what
 * makes the output stable across runs.
 */
function serialize(models: Record<string, Rates>, asOf: string): string {
  const sorted: Record<string, Rates> = {};
  for (const key of Object.keys(models).sort()) {
    // Field order is fixed by RATE_FIELDS, not by upstream key order.
    sorted[key] = {
      input_cost_per_token: models[key].input_cost_per_token,
      cache_read_input_token_cost: models[key].cache_read_input_token_cost,
      output_cost_per_token: models[key].output_cost_per_token,
    };
  }

  return `${JSON.stringify({ asOf, source: FEED_URL, models: sorted }, null, 2)}\n`;
}

async function main(): Promise<void> {
  const asOf = parseAsOf(process.argv.slice(2));

  const response = await fetch(FEED_URL);
  if (!response.ok) {
    throw new Error(`price feed returned HTTP ${response.status}`);
  }

  const feed = (await response.json()) as Record<string, unknown>;

  const models: Record<string, Rates> = {};
  let skippedPartial = 0;

  for (const [key, entry] of Object.entries(feed)) {
    if (!isOpenAiEntry(entry)) {
      continue;
    }
    const rates = completeRates(entry);
    if (rates === null) {
      skippedPartial += 1;
      continue;
    }
    models[key] = rates;
  }

  if (Object.keys(models).length === 0) {
    throw new Error('refusing to write an empty snapshot — upstream schema may have changed');
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, serialize(models, asOf), 'utf8');

  // eslint-disable-next-line no-console
  console.log(
    `wrote ${Object.keys(models).length} priced models to ${OUT_PATH} (asOf ${asOf}); ` +
      `skipped ${skippedPartial} OpenAI entries missing at least one rate`
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
