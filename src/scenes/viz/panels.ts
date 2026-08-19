import { FieldColorModeId } from '@grafana/data';
import {
  FieldConfigOverridesBuilder,
  PanelBuilders,
  SceneDataProvider,
  SceneDataTransformer,
} from '@grafana/scenes';
import { LegendDisplayMode, VizLegendOptions } from '@grafana/schema';

import { ClusterMode, clusterSeries } from './clustering';
import { RESIDUAL_SERIES_COLOR, SEMANTIC_SERIES_COLORS } from './palette';

/**
 * The shared panel contract (REQ-010).
 *
 * Every panel in the app is built through one of these factories rather than
 * calling `PanelBuilders.*` directly. That indirection is what makes REQ-010
 * enforceable instead of aspirational: legend placement, colour mode, display
 * limits and units are applied here, in one place, and a scene has no
 * opportunity to declare its own.
 *
 * Factories return the builder, not a built panel, so a scene can still add
 * genuinely panel-specific configuration (a stat's graph mode, a table's sort
 * column) without reaching for `PanelBuilders`.
 */

/** Chart types that draw more than one series and therefore need a limit. */
export type MultiSeriesChartType = 'pie' | 'bar' | 'timeseries';

/**
 * Maximum number of individually drawn series per chart type, before any
 * residual. Declared once; nothing else may restate these numbers.
 */
export const DISPLAY_LIMITS: Record<MultiSeriesChartType, number> = {
  pie: 6,
  bar: 10,
  timeseries: 8,
};

/**
 * The quantities this app plots. A caller names the quantity and gets the
 * project-wide unit for it (REQ-013) — no call site passes a unit string.
 */
export type Quantity = 'cost' | 'count' | 'tokens' | 'rate' | 'durationSeconds' | 'durationMs';

export const QUANTITY_UNITS: Record<Quantity, string> = {
  cost: 'currencyUSD',
  count: 'short',
  tokens: 'short',
  rate: 'percent',
  durationSeconds: 's',
  durationMs: 'ms',
};

/**
 * Legend configuration per chart type (REQ-012). Bar gauges label inline and
 * have no legend option at all, so they are absent by design.
 */
const LEGENDS: Record<'pie' | 'timeseries', VizLegendOptions> = {
  pie: {
    displayMode: LegendDisplayMode.Table,
    placement: 'right',
    showLegend: true,
    calcs: [],
    values: ['value', 'percent'],
  } as VizLegendOptions,
  timeseries: {
    displayMode: LegendDisplayMode.List,
    placement: 'bottom',
    showLegend: true,
    calcs: [],
  },
};

/** Regex matching any residual series name, whatever count it carries. */
const RESIDUAL_NAME_PATTERN = '^Other \\(\\d+ more\\)$';

export interface ClusterSpec {
  mode: ClusterMode;
  /** Defaults to the chart type's display limit. */
  limit?: number;
}

interface BasePanelOptions {
  title: string;
  description?: string;
  quantity: Quantity;
  data: SceneDataProvider;
}

interface MultiSeriesPanelOptions extends BasePanelOptions {
  /** Omit to draw every series the query returned. */
  cluster?: ClusterSpec;
}

/**
 * Attach clustering between the query runner and the panel, if requested.
 *
 * Placing the transformer here — after the query — is what makes clustering
 * see exactly the series the filter variables produced (REQ-006).
 */
function withClustering(
  data: SceneDataProvider,
  chartType: MultiSeriesChartType,
  cluster: ClusterSpec | undefined
): SceneDataProvider {
  if (!cluster) {
    return data;
  }
  return new SceneDataTransformer({
    $data: data,
    transformations: [clusterSeries({ limit: cluster.limit ?? DISPLAY_LIMITS[chartType], mode: cluster.mode })],
  });
}

/**
 * Field overrides pinning every semantically meaningful series name to its
 * fixed colour (REQ-008).
 *
 * An override wins over the name-derived palette colour, which is exactly the
 * precedence the requirement asks for. Overrides matching no field on a given
 * panel are simply inert, so one shared set is safe to apply everywhere.
 *
 * The residual is matched by regex rather than by name because the count it
 * carries makes every residual name a different string.
 */
function semanticColorOverrides(b: FieldConfigOverridesBuilder<unknown>): void {
  for (const [seriesName, color] of Object.entries(SEMANTIC_SERIES_COLORS)) {
    b.matchFieldsWithName(seriesName).overrideColor({ mode: FieldColorModeId.Fixed, fixedColor: color });
  }
  b.matchFieldsWithNameByRegex(RESIDUAL_NAME_PATTERN).overrideColor({
    mode: FieldColorModeId.Fixed,
    fixedColor: RESIDUAL_SERIES_COLOR,
  });
}

/** Time series: trend over time. */
export function timeseriesPanel(options: MultiSeriesPanelOptions) {
  const builder = PanelBuilders.timeseries()
    .setTitle(options.title)
    .setUnit(QUANTITY_UNITS[options.quantity])
    .setData(withClustering(options.data, 'timeseries', options.cluster))
    .setColor({ mode: FieldColorModeId.PaletteClassicByName })
    .setOption('legend', LEGENDS.timeseries)
    .setCustomFieldConfig('fillOpacity', 30);

  if (options.description) {
    builder.setDescription(options.description);
  }
  return builder.setOverrides(semanticColorOverrides);
}

/** Pie: part-to-whole over a bounded dimension (REQ-011). */
export function piePanel(options: MultiSeriesPanelOptions) {
  const builder = PanelBuilders.piechart()
    .setTitle(options.title)
    .setUnit(QUANTITY_UNITS[options.quantity])
    .setData(withClustering(options.data, 'pie', options.cluster))
    .setColor({ mode: FieldColorModeId.PaletteClassicByName })
    .setOption('legend', LEGENDS.pie)
    .setOption('pieType', 'donut' as never);

  if (options.description) {
    builder.setDescription(options.description);
  }
  return builder.setOverrides(semanticColorOverrides);
}

/**
 * Bar: ranked comparison (REQ-011).
 *
 * Wraps `PanelBuilders.bargauge` — the idiom already used by four panels — so
 * converting a pie to a bar introduces no new panel plugin dependency.
 */
export function barPanel(options: MultiSeriesPanelOptions) {
  const builder = PanelBuilders.bargauge()
    .setTitle(options.title)
    .setUnit(QUANTITY_UNITS[options.quantity])
    .setData(withClustering(options.data, 'bar', options.cluster))
    .setColor({ mode: FieldColorModeId.PaletteClassicByName })
    .setOption('displayMode', 'gradient' as never)
    .setOption('orientation', 'horizontal' as never)
    .setOption('valueMode', 'text' as never)
    .setOption('showUnfilled', true)
    .setOption('minVizWidth', 150)
    .setOption('minVizHeight', 25)
    .setDisplayName('${__series.name}');

  if (options.description) {
    builder.setDescription(options.description);
  }
  return builder.setOverrides(semanticColorOverrides);
}

/**
 * Table.
 *
 * Deliberately takes no `cluster` option: a table is scannable and sortable,
 * so per-row detail is the point, and passing one is a compile error rather
 * than a convention someone has to remember (REQ-015).
 */
export function tablePanel(options: Omit<BasePanelOptions, 'quantity'> & { quantity?: Quantity }) {
  const builder = PanelBuilders.table().setTitle(options.title).setData(options.data);

  if (options.quantity) {
    builder.setUnit(QUANTITY_UNITS[options.quantity]);
  }
  if (options.description) {
    builder.setDescription(options.description);
  }
  return builder;
}

/**
 * Stat: one number.
 *
 * Stats show a single value, so the palette rules do not apply to them — they
 * keep their existing fixed or threshold colour, passed through here.
 *
 * `quantity` is optional only because a few stats display a string rather than
 * a quantity (the Codex price-table provenance, for one), and a unit on those
 * would be meaningless. Any stat showing a number must still name its quantity.
 */
export function statPanel(
  options: Omit<BasePanelOptions, 'quantity'> & {
    quantity?: Quantity;
    color?: { mode: string; fixedColor?: string };
  }
) {
  const builder = PanelBuilders.stat().setTitle(options.title).setData(options.data);

  if (options.quantity) {
    builder.setUnit(QUANTITY_UNITS[options.quantity]);
  }
  if (options.color) {
    builder.setColor(options.color);
  }
  if (options.description) {
    builder.setDescription(options.description);
  }
  return builder;
}
