import snapshot from '../price-snapshot.json';
import { DEFAULT_PRICE_FEED_URL } from '../settings';
import { __resetPriceTableCache, resolvePriceTable } from '../priceTable';

const LIVE_RATES = {
  litellm_provider: 'openai',
  input_cost_per_token: 9e-6,
  cache_read_input_token_cost: 9e-7,
  output_cost_per_token: 9e-5,
};

/**
 * A feed narrow enough to be rejected: it parses cleanly but prices almost
 * nothing next to the bundled table.
 */
const NARROW_FEED = {
  'gpt-5.6-sol': LIVE_RATES,
  'anthropic/claude-x': {
    litellm_provider: 'anthropic',
    input_cost_per_token: 1e-6,
    cache_read_input_token_cost: 1e-7,
    output_cost_per_token: 1e-5,
  },
};

/**
 * A realistic feed: covers the bundled table, plus whatever extras are passed.
 * The real upstream covers 100% of the snapshot's keys.
 */
const wideFeed = (extras: Record<string, unknown> = {}): Record<string, unknown> => {
  const feed: Record<string, unknown> = {};
  for (const key of Object.keys(snapshot.models)) {
    feed[key] = LIVE_RATES;
  }
  return { ...feed, ...extras };
};

const LIVE_FEED = wideFeed({
  'anthropic/claude-x': {
    litellm_provider: 'anthropic',
    input_cost_per_token: 1e-6,
    cache_read_input_token_cost: 1e-7,
    output_cost_per_token: 1e-5,
  },
});

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('resolvePriceTable', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    __resetPriceTableCache();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('refresh disabled', () => {
    it('returns the bundled snapshot with provenance "snapshot" and issues no fetch', async () => {
      const table = await resolvePriceTable({ priceRefreshEnabled: false, priceFeedUrl: DEFAULT_PRICE_FEED_URL });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(table.source).toBe('snapshot');
      expect(table.asOf).toBe(snapshot.asOf);
      expect(table.rates['gpt-5.3-codex']).toEqual(snapshot.models['gpt-5.3-codex']);
    });
  });

  describe('refresh enabled', () => {
    it('returns live rates with provenance "live"', async () => {
      fetchMock.mockResolvedValue(okResponse(LIVE_FEED));

      const table = await resolvePriceTable({ priceRefreshEnabled: true, priceFeedUrl: 'https://feed.test/p.json' });

      expect(fetchMock).toHaveBeenCalledWith('https://feed.test/p.json', expect.anything());
      expect(table.source).toBe('live');
      expect(table.rates['gpt-5.6-sol'].input_cost_per_token).toBe(9e-6);
    });

    it('keeps only openai-provider entries carrying a complete rate triple', async () => {
      fetchMock.mockResolvedValue(
        okResponse(
          wideFeed({
            'anthropic/claude-x': { litellm_provider: 'anthropic', input_cost_per_token: 1e-6 },
            'gpt-partial': { litellm_provider: 'openai', input_cost_per_token: 1e-6, output_cost_per_token: 1e-5 },
          })
        )
      );

      const table = await resolvePriceTable({ priceRefreshEnabled: true, priceFeedUrl: 'https://feed.test/p.json' });

      expect(table.rates['gpt-5.6-sol']).toBeDefined();
      expect(table.rates['anthropic/claude-x']).toBeUndefined();
      expect(table.rates['gpt-partial']).toBeUndefined();
    });

    it('reports an asOf reflecting the source used, not the build date', async () => {
      fetchMock.mockResolvedValue(okResponse({ ...LIVE_FEED, asOf: '2030-01-02' }));

      const table = await resolvePriceTable({ priceRefreshEnabled: true, priceFeedUrl: 'https://feed.test/p.json' });

      expect(table.asOf).toBe('2030-01-02');
      expect(table.asOf).not.toBe(snapshot.asOf);
    });
  });

  describe('fallback', () => {
    const expectFallback = async () => {
      const table = await resolvePriceTable({ priceRefreshEnabled: true, priceFeedUrl: 'https://feed.test/p.json' });

      // 'fallback' must stay distinct from 'snapshot': a viewer has to be able
      // to tell "these are the shipped prices" from "the refresh was blocked".
      expect(table.source).toBe('fallback');
      expect(table.asOf).toBe(snapshot.asOf);
      expect(table.rates['gpt-5.3-codex']).toEqual(snapshot.models['gpt-5.3-codex']);
      return table;
    };

    it('falls back when the fetch rejects', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      await expectFallback();
    });

    it('falls back on a non-2xx response', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
      await expectFallback();
    });

    it('falls back on a malformed payload', async () => {
      fetchMock.mockResolvedValue(okResponse('not an object'));
      await expectFallback();
    });

    it('falls back when the payload parses but yields no usable rates', async () => {
      // An upstream schema change must degrade to the known-good table, never
      // to a wrong number or an empty one.
      fetchMock.mockResolvedValue(okResponse({ 'gpt-5.6-sol': { litellm_provider: 'openai' } }));
      await expectFallback();
    });

    it('falls back when the response body is not JSON at all', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token < in JSON');
        },
      });
      await expectFallback();
    });

    it('falls back when the feed prices far fewer models than the bundled table', async () => {
      // A truncated, partially migrated or misconfigured feed can parse cleanly
      // and still price almost nothing. Accepting it would silently replace the
      // bundled table, push active models into the unpriced bucket and
      // understate cost — the "degrade to a wrong number" case the fallback
      // exists to prevent. Coverage is judged against the bundled table because
      // both come from the same upstream.
      fetchMock.mockResolvedValue(okResponse(NARROW_FEED));
      await expectFallback();
    });

    it('accepts a feed that covers the bundled table even if most upstream entries are incomplete', async () => {
      // 59% of the real feed's openai-provider entries legitimately lack a
      // complete rate triple, so a discard-ratio guard would reject the genuine
      // article. Coverage, not discard ratio, is the signal.
      const incomplete: Record<string, unknown> = {};
      for (let i = 0; i < 500; i++) {
        incomplete[`incomplete-${i}`] = { litellm_provider: 'openai', input_cost_per_token: 1e-6 };
      }
      fetchMock.mockResolvedValue(okResponse(wideFeed(incomplete)));

      const table = await resolvePriceTable({ priceRefreshEnabled: true, priceFeedUrl: 'https://feed.test/p.json' });

      expect(table.source).toBe('live');
      expect(table.rates['gpt-5.3-codex'].input_cost_per_token).toBe(9e-6);
    });

    it('accepts a feed that drops a few deprecated models', async () => {
      // Ordinary upstream churn must not trip the guard.
      const keys = Object.keys(snapshot.models);
      const wide: Record<string, unknown> = {};
      for (const key of keys.slice(0, keys.length - 5)) {
        wide[key] = LIVE_RATES;
      }
      fetchMock.mockResolvedValue(okResponse(wide));

      const table = await resolvePriceTable({ priceRefreshEnabled: true, priceFeedUrl: 'https://feed.test/p.json' });

      expect(table.source).toBe('live');
    });
  });

  describe('memoisation', () => {
    it('triggers at most one fetch across ten concurrent calls', async () => {
      fetchMock.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(okResponse(LIVE_FEED)), 5))
      );

      const settings = { priceRefreshEnabled: true, priceFeedUrl: 'https://feed.test/p.json' };
      const tables = await Promise.all(Array.from({ length: 10 }, () => resolvePriceTable(settings)));

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(tables).toHaveLength(10);
      for (const table of tables) {
        expect(table.source).toBe('live');
      }
    });

    it('shares the resolved table across sequential calls too', async () => {
      fetchMock.mockResolvedValue(okResponse(LIVE_FEED));
      const settings = { priceRefreshEnabled: true, priceFeedUrl: 'https://feed.test/p.json' };

      const first = await resolvePriceTable(settings);
      const second = await resolvePriceTable(settings);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    });

    it('re-resolves when the settings change', async () => {
      fetchMock.mockResolvedValue(okResponse(LIVE_FEED));

      await resolvePriceTable({ priceRefreshEnabled: true, priceFeedUrl: 'https://feed.test/a.json' });
      await resolvePriceTable({ priceRefreshEnabled: true, priceFeedUrl: 'https://feed.test/b.json' });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
