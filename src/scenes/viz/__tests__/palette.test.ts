import { createTheme } from '@grafana/data';

import { MODEL_FAMILIES, OTHER_FAMILY } from '../../../constants';
import {
  SEMANTIC_SERIES_COLORS,
  RESIDUAL_SERIES_PREFIX,
  RESIDUAL_SERIES_COLOR,
  residualSeriesName,
  isResidualSeriesName,
  semanticColorFor,
} from '../palette';

describe('SEMANTIC_SERIES_COLORS', () => {
  it('resolves a colour for every provider family display name', () => {
    for (const family of MODEL_FAMILIES) {
      expect(SEMANTIC_SERIES_COLORS[family.display]).toBeDefined();
    }
  });

  it('resolves a colour for the catch-all family display name', () => {
    expect(SEMANTIC_SERIES_COLORS[OTHER_FAMILY.display]).toBeDefined();
  });

  it('resolves fixed colours for the decision and lines-of-code pairs', () => {
    expect(SEMANTIC_SERIES_COLORS['accept']).toBe('green');
    expect(SEMANTIC_SERIES_COLORS['reject']).toBe('red');
    expect(SEMANTIC_SERIES_COLORS['added']).toBe('green');
    expect(SEMANTIC_SERIES_COLORS['removed']).toBe('red');
  });

  it('uses Grafana named palette colours, never hex literals', () => {
    for (const color of Object.values(SEMANTIC_SERIES_COLORS)) {
      expect(color).not.toMatch(/^#/);
      expect(color).toMatch(/^[a-z][a-z-]*$/);
    }
  });

  // The check above is not enough on its own: 'text-disabled' passes it and is
  // still not a colour Grafana can resolve. getColorByName returns an unknown
  // name UNCHANGED, so the failure only surfaces later, when the panel asks the
  // theme for a fill alpha and throws "Unsupported 'text-disabled' color".
  // Assert resolution here instead of trusting the name's shape.
  it.each(['dark', 'light'] as const)('resolves every colour to a real %s-theme value', (mode) => {
    const theme = createTheme({ colors: { mode } });

    for (const [seriesName, color] of Object.entries(SEMANTIC_SERIES_COLORS)) {
      const resolved = theme.visualization.getColorByName(color);
      expect(`${seriesName}=${resolved}`).toMatch(/=(#|rgb)/);
    }
  });

  it('resolves the residual colour to a real value in both themes', () => {
    for (const mode of ['dark', 'light'] as const) {
      const resolved = createTheme({ colors: { mode } }).visualization.getColorByName(RESIDUAL_SERIES_COLOR);
      expect(resolved).toMatch(/^(#|rgb)/);
    }
  });
});

describe('residualSeriesName', () => {
  it('states how many series it aggregates, so 2 is distinguishable from 40', () => {
    expect(residualSeriesName(2)).toContain('2');
    expect(residualSeriesName(40)).toContain('40');
    expect(residualSeriesName(2)).not.toEqual(residualSeriesName(40));
  });

  it('singularises a one-series residual', () => {
    expect(residualSeriesName(1)).toContain('1');
    expect(residualSeriesName(1)).not.toContain('series');
  });

  it('starts with the shared residual prefix, so callers can detect one', () => {
    expect(residualSeriesName(3).startsWith(RESIDUAL_SERIES_PREFIX)).toBe(true);
  });
});

describe('isResidualSeriesName', () => {
  it('recognises a residual name at any count and rejects an ordinary one', () => {
    expect(isResidualSeriesName(residualSeriesName(2))).toBe(true);
    expect(isResidualSeriesName(residualSeriesName(40))).toBe(true);
    expect(isResidualSeriesName('Claude')).toBe(false);
  });
});

describe('semanticColorFor', () => {
  it('resolves the residual colour for a residual name at any count', () => {
    expect(semanticColorFor(residualSeriesName(2))).toBe(RESIDUAL_SERIES_COLOR);
    expect(semanticColorFor(residualSeriesName(40))).toBe(RESIDUAL_SERIES_COLOR);
  });

  it('resolves a provider family name to its fixed colour', () => {
    expect(semanticColorFor(MODEL_FAMILIES[0].display)).toBe(SEMANTIC_SERIES_COLORS[MODEL_FAMILIES[0].display]);
  });

  it('returns undefined for a name with no established meaning', () => {
    expect(semanticColorFor('my-macbook')).toBeUndefined();
  });
});
