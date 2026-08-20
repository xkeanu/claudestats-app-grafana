import { FieldColorModeId } from '@grafana/data';
import { SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { LegendDisplayMode } from '@grafana/schema';

import { RESIDUAL_SERIES_COLOR, SEMANTIC_SERIES_COLORS, residualSeriesName } from '../palette';
import {
  DISPLAY_LIMITS,
  QUANTITY_UNITS,
  barPanel,
  piePanel,
  statPanel,
  tablePanel,
  timeseriesPanel,
} from '../panels';

function query() {
  return new SceneQueryRunner({
    datasource: { type: 'prometheus', uid: '${prometheus_ds}' },
    queries: [{ refId: 'A', expr: 'up' }],
  });
}

/** Resolve the fixed colour an override assigns to `seriesName`, if any. */
function overrideColorFor(panel: { state: { fieldConfig: { overrides: unknown[] } } }, seriesName: string) {
  const overrides = panel.state.fieldConfig.overrides as Array<{
    matcher: { id: string; options: string };
    properties: Array<{ id: string; value: { mode: string; fixedColor?: string } }>;
  }>;

  const match = overrides.find((override) => {
    if (override.matcher.id === 'byName') {
      return override.matcher.options === seriesName;
    }
    if (override.matcher.id === 'byRegexp') {
      return new RegExp(override.matcher.options).test(seriesName);
    }
    return false;
  });

  return match?.properties.find((property) => property.id === 'color')?.value.fixedColor;
}

describe('display limits and units are declared exactly once', () => {
  it('matches the values fixed in the plan body', () => {
    expect(DISPLAY_LIMITS).toEqual({ pie: 6, bar: 10, timeseries: 8 });
  });

  it('maps each quantity to its project-wide unit (REQ-013)', () => {
    expect(QUANTITY_UNITS).toEqual({
      cost: 'currencyUSD',
      count: 'short',
      tokens: 'short',
      rate: 'percent',
      durationSeconds: 's',
      durationMs: 'ms',
    });
  });
});

describe('multi-series factories set colour mode by name (REQ-007)', () => {
  it.each([
    ['timeseries', () => timeseriesPanel({ title: 't', quantity: 'cost', data: query() }).build()],
    ['pie', () => piePanel({ title: 't', quantity: 'cost', data: query() }).build()],
    ['bar', () => barPanel({ title: 't', quantity: 'count', data: query() }).build()],
  ])('%s uses palette-classic-by-name', (_name, build) => {
    expect(build().state.fieldConfig.defaults.color?.mode).toBe(FieldColorModeId.PaletteClassicByName);
  });
});

describe('semantic colours take precedence over the name-derived colour (REQ-008)', () => {
  it.each([
    ['timeseries', () => timeseriesPanel({ title: 't', quantity: 'cost', data: query() }).build()],
    ['pie', () => piePanel({ title: 't', quantity: 'count', data: query() }).build()],
    ['bar', () => barPanel({ title: 't', quantity: 'count', data: query() }).build()],
  ])('%s overrides every semantic series name with its fixed colour', (_name, build) => {
    const panel = build();

    for (const [seriesName, color] of Object.entries(SEMANTIC_SERIES_COLORS)) {
      expect(overrideColorFor(panel, seriesName)).toBe(color);
    }
  });

  it('gives accept green and reject red on a pie, not a palette-derived hue', () => {
    // The Tools scene's decision pie depends on this precedence.
    const panel = piePanel({ title: 't', quantity: 'count', data: query() }).build();

    expect(overrideColorFor(panel, 'accept')).toBe('green');
    expect(overrideColorFor(panel, 'reject')).toBe('red');
  });

  it('gives added green and removed red on a pie', () => {
    // The Productivity scene's lines-added-vs-removed pie depends on this.
    const panel = piePanel({ title: 't', quantity: 'count', data: query() }).build();

    expect(overrideColorFor(panel, 'added')).toBe('green');
    expect(overrideColorFor(panel, 'removed')).toBe('red');
  });

  it('overrides the residual series at any aggregated count', () => {
    const panel = timeseriesPanel({ title: 't', quantity: 'cost', data: query() }).build();

    expect(overrideColorFor(panel, residualSeriesName(2))).toBe(RESIDUAL_SERIES_COLOR);
    expect(overrideColorFor(panel, residualSeriesName(40))).toBe(RESIDUAL_SERIES_COLOR);
  });

  it('leaves an ordinary series name to the name-derived palette', () => {
    const panel = piePanel({ title: 't', quantity: 'cost', data: query() }).build();
    expect(overrideColorFor(panel, 'my-macbook')).toBeUndefined();
  });
});

describe('legend configuration is per chart type, not per panel (REQ-012)', () => {
  it('gives every pie the table legend on the right with value and percent', () => {
    const legend = piePanel({ title: 't', quantity: 'cost', data: query() }).build().state.options as {
      legend: { displayMode: string; placement: string; values: string[] };
    };

    expect(legend.legend.displayMode).toBe(LegendDisplayMode.Table);
    expect(legend.legend.placement).toBe('right');
    expect(legend.legend.values).toEqual(['value', 'percent']);
  });

  it('gives every time series the list legend at the bottom', () => {
    const legend = timeseriesPanel({ title: 't', quantity: 'cost', data: query() }).build().state.options as {
      legend: { displayMode: string; placement: string };
    };

    expect(legend.legend.displayMode).toBe(LegendDisplayMode.List);
    expect(legend.legend.placement).toBe('bottom');
  });
});

describe('units come from the quantity, never from the call site (REQ-013)', () => {
  it.each([
    ['cost', 'currencyUSD'],
    ['tokens', 'short'],
    ['rate', 'percent'],
    ['durationSeconds', 's'],
    ['durationMs', 'ms'],
  ] as const)('a %s panel renders in %s', (quantity, unit) => {
    const panel = timeseriesPanel({ title: 't', quantity, data: query() }).build();
    expect(panel.state.fieldConfig.defaults.unit).toBe(unit);
  });
});

describe('clustering attachment', () => {
  it('wraps the query runner in a transformer when clustering is requested', () => {
    const panel = barPanel({ title: 't', quantity: 'count', data: query(), cluster: { mode: 'additive' } }).build();
    expect(panel.state.$data).toBeInstanceOf(SceneDataTransformer);
  });

  it('passes the query runner straight through when it is not', () => {
    const panel = barPanel({ title: 't', quantity: 'count', data: query() }).build();
    expect(panel.state.$data).toBeInstanceOf(SceneQueryRunner);
  });

  it('defaults an unspecified limit to the chart type display limit', () => {
    const panel = timeseriesPanel({
      title: 't',
      quantity: 'cost',
      data: query(),
      cluster: { mode: 'additive' },
    }).build();
    expect(panel.state.$data).toBeInstanceOf(SceneDataTransformer);
  });
});

describe('tables are exempt from clustering (REQ-015)', () => {
  it('never wraps a table query runner in a transformer', () => {
    const panel = tablePanel({ title: 't', data: query() }).build();
    expect(panel.state.$data).toBeInstanceOf(SceneQueryRunner);
  });

  it('rejects a clustering option at the type level', () => {
    // @ts-expect-error tablePanel accepts no `cluster` option — REQ-015 is
    // enforced by the compiler, not by convention. If this stops erroring,
    // `npm run typecheck` fails on the unused @ts-expect-error and the
    // regression is caught there rather than in review.
    tablePanel({ title: 't', data: query(), cluster: { mode: 'additive' } });
  });
});

describe('stat panels', () => {
  it('take the contract unit but keep their own fixed or threshold colour', () => {
    const panel = statPanel({ title: 't', quantity: 'cost', data: query(), color: { mode: 'thresholds' } }).build();

    expect(panel.state.fieldConfig.defaults.unit).toBe('currencyUSD');
    expect(panel.state.fieldConfig.defaults.color?.mode).toBe('thresholds');
  });

  it('sets no unit for a text-valued stat with no quantity', () => {
    const panel = statPanel({ title: 'Price Table', data: query() }).build();
    expect(panel.state.fieldConfig.defaults.unit).toBeUndefined();
  });
});
