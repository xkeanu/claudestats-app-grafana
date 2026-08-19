import { ClaudeStatsSettings } from '../types';

/**
 * LiteLLM's public price feed — the same source `npm run update-prices` reads
 * when regenerating the bundled snapshot, so live and snapshot tables share a
 * schema.
 */
export const DEFAULT_PRICE_FEED_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

/** Price settings with every default already applied. */
export interface ResolvedPriceSettings {
  priceRefreshEnabled: boolean;
  priceFeedUrl: string;
}

/**
 * Applies defaults to whatever is (or is not) saved in the plugin's `jsonData`.
 *
 * `jsonData` round-trips through JSON and through hand-edited provisioning
 * YAML, so the enable flag is checked with `=== true` rather than for
 * truthiness: the string `"false"` is truthy in JavaScript, and reading it as
 * "enabled" would silently defeat the default-off guarantee of REQ-011.
 */
export function resolvePriceSettings(jsonData?: Partial<ClaudeStatsSettings>): ResolvedPriceSettings {
  const savedUrl = typeof jsonData?.priceFeedUrl === 'string' ? jsonData.priceFeedUrl.trim() : '';

  return {
    priceRefreshEnabled: jsonData?.priceRefreshEnabled === true,
    priceFeedUrl: savedUrl === '' ? DEFAULT_PRICE_FEED_URL : savedUrl,
  };
}
