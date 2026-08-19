import { DEFAULT_PRICE_FEED_URL, resolvePriceSettings } from '../settings';

describe('resolvePriceSettings', () => {
  it('resolves a fresh install with no saved jsonData to refresh-disabled', () => {
    expect(resolvePriceSettings(undefined)).toEqual({
      priceRefreshEnabled: false,
      priceFeedUrl: DEFAULT_PRICE_FEED_URL,
    });
  });

  it('resolves an empty jsonData object to refresh-disabled', () => {
    expect(resolvePriceSettings({})).toEqual({
      priceRefreshEnabled: false,
      priceFeedUrl: DEFAULT_PRICE_FEED_URL,
    });
  });

  it('honours an explicit enable', () => {
    expect(resolvePriceSettings({ priceRefreshEnabled: true })).toEqual({
      priceRefreshEnabled: true,
      priceFeedUrl: DEFAULT_PRICE_FEED_URL,
    });
  });

  it('honours a custom feed url', () => {
    expect(resolvePriceSettings({ priceRefreshEnabled: true, priceFeedUrl: 'https://example.test/p.json' })).toEqual({
      priceRefreshEnabled: true,
      priceFeedUrl: 'https://example.test/p.json',
    });
  });

  it('falls back to the default url when the saved url is blank or whitespace', () => {
    expect(resolvePriceSettings({ priceFeedUrl: '   ' }).priceFeedUrl).toBe(DEFAULT_PRICE_FEED_URL);
    expect(resolvePriceSettings({ priceFeedUrl: '' }).priceFeedUrl).toBe(DEFAULT_PRICE_FEED_URL);
  });

  it('treats a non-boolean enable flag as disabled rather than truthy', () => {
    // jsonData round-trips through JSON and hand-editable provisioning YAML,
    // so "false" and "" are both plausible on disk.
    expect(resolvePriceSettings({ priceRefreshEnabled: 'false' as unknown as boolean }).priceRefreshEnabled).toBe(false);
    expect(resolvePriceSettings({ priceRefreshEnabled: 1 as unknown as boolean }).priceRefreshEnabled).toBe(false);
  });

  it('trims a saved url so a trailing newline cannot break the fetch', () => {
    expect(resolvePriceSettings({ priceFeedUrl: ' https://example.test/p.json\n' }).priceFeedUrl).toBe(
      'https://example.test/p.json'
    );
  });
});
