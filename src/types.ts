/**
 * Plugin JSON data stored in Grafana
 */
export interface ClaudeStatsSettings {
  /**
   * Opt in to refreshing the model price table from a live feed instead of
   * using the snapshot bundled at build time.
   *
   * Absent or non-`true` means disabled, and disabled means the plugin issues
   * NO outbound request for price data at all (REQ-011). That default is
   * load-bearing rather than a preference: a dashboard must not reach a third
   * party on load unless an operator asked it to.
   */
  priceRefreshEnabled?: boolean;

  /**
   * Feed fetched when `priceRefreshEnabled` is true. Absent or blank falls back
   * to `DEFAULT_PRICE_FEED_URL`.
   */
  priceFeedUrl?: string;

  /**
   * Team member `UUID|Display Name` mappings, one per line, set via
   * provisioning (see provisioning/plugins/apps.yaml).
   *
   * Declared here so it survives a config-page save: the settings endpoint
   * replaces `jsonData` wholesale, so any key omitted from the payload is
   * destroyed.
   */
  teamMembers?: string;
}
