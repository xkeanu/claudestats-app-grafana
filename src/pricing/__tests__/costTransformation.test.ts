import { toDataFrame, FieldType, DataFrame } from '@grafana/data';
import { firstValueFrom, of } from 'rxjs';
import {
  codexTokenRowsFromFrames,
  describePriceTable,
  makeCostTransformation,
  COST_FIELD_NAME,
  UNPRICED_FIELD_NAME,
  PROVENANCE_FIELD_NAME,
} from '../costTransformation';
import { ModelRates, PriceTable } from '../priceTable';

const CODEX_RATES: ModelRates = {
  input_cost_per_token: 1.75e-6,
  cache_read_input_token_cost: 1.75e-7,
  output_cost_per_token: 1.4e-5,
};

const TABLE: PriceTable = {
  source: 'snapshot',
  asOf: '2026-08-19',
  rates: { 'gpt-5.3-codex': CODEX_RATES },
};

/**
 * Mimics a Prometheus range response: one frame per series, labels on the
 * value field, each frame carrying its OWN time axis — Grafana does not pad
 * series onto a shared grid.
 *
 * `endTime` defaults to a shared window end; pass a smaller one to model a
 * series that stopped part-way through the window.
 */
const STEP = 1000;
const WINDOW_END = 100_000;

const seriesFrame = (labels: Record<string, string>, values: number[], endTime = WINDOW_END): DataFrame =>
  toDataFrame({
    refId: 'CodexTokensByModelAndType',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        values: values.map((_, i) => endTime - (values.length - 1 - i) * STEP),
      },
      { name: 'Value', type: FieldType.number, values, labels },
    ],
  });

const runTransform = async (frames: DataFrame[], table: PriceTable, output: Parameters<typeof makeCostTransformation>[0]) => {
  const operator = makeCostTransformation(output, () => Promise.resolve(table));
  // The Scenes CustomTransformOperator is (ctx) => MonoTypeOperatorFunction.
  const result = await firstValueFrom(of(frames).pipe(operator({} as never)));
  return result;
};

describe('codexTokenRowsFromFrames', () => {
  it('reads model and token_type off the value field labels', () => {
    const rows = codexTokenRowsFromFrames([
      seriesFrame({ model: 'gpt-5.3-codex', token_type: 'input' }, [10, 20, 30]),
      seriesFrame({ model: 'gpt-5.3-codex', token_type: 'output' }, [1, 2]),
    ]);

    // increase() over $__range is cumulative across the window, so the last
    // point is the window total — the same reduction the stat panels use.
    expect(rows).toEqual([
      { model: 'gpt-5.3-codex', token_type: 'input', tokens: 30 },
      { model: 'gpt-5.3-codex', token_type: 'output', tokens: 2 },
    ]);
  });

  it('drops a series that stopped well before the end of the window', () => {
    // Grafana returns one frame per series with its own time axis, so a model
    // that went idle mid-window simply ends early. Its last recorded total is
    // stale, and counting it treats old usage as current. Observed live:
    // gpt-5.3-codex-spark, idle 20 days, inflated unpriced volume by 11.6M.
    const rows = codexTokenRowsFromFrames([
      seriesFrame({ model: 'gpt-5.6-sol', token_type: 'input' }, [10, 25, 31]),
      seriesFrame({ model: 'gpt-5.3-codex', token_type: 'input' }, [900, 950], WINDOW_END - 20 * STEP),
    ]);

    expect(rows).toEqual([{ model: 'gpt-5.6-sol', token_type: 'input', tokens: 31 }]);
  });

  it('keeps a series that merely lags by a step of scrape jitter', () => {
    const rows = codexTokenRowsFromFrames([
      seriesFrame({ model: 'gpt-5.6-sol', token_type: 'input' }, [10, 25, 31]),
      seriesFrame({ model: 'gpt-5.3-codex', token_type: 'input' }, [900, 950], WINDOW_END - STEP),
    ]);

    expect(rows).toContainEqual({ model: 'gpt-5.3-codex', token_type: 'input', tokens: 950 });
  });

  it('reads the value at the final point for a live series', () => {
    const rows = codexTokenRowsFromFrames([
      seriesFrame({ model: 'gpt-5.3-codex', token_type: 'input' }, [10, 25, 31]),
    ]);

    expect(rows).toEqual([{ model: 'gpt-5.3-codex', token_type: 'input', tokens: 31 }]);
  });

  it('skips frames carrying no model or token_type label', () => {
    expect(codexTokenRowsFromFrames([seriesFrame({ model: 'gpt-5.3-codex' }, [10])])).toEqual([]);
    expect(codexTokenRowsFromFrames([seriesFrame({ token_type: 'input' }, [10])])).toEqual([]);
  });

  it('returns nothing for an empty frame set', () => {
    expect(codexTokenRowsFromFrames([])).toEqual([]);
  });
});

describe('describePriceTable', () => {
  it('names the bundled table and its date', () => {
    expect(describePriceTable({ ...TABLE, source: 'snapshot' })).toBe('Bundled prices · 2026-08-19');
  });

  it('names live prices and their date', () => {
    expect(describePriceTable({ ...TABLE, source: 'live', asOf: '2026-09-01' })).toBe('Live prices · 2026-09-01');
  });

  it('says outright that a fallback is a blocked refresh, not a chosen default', () => {
    expect(describePriceTable({ ...TABLE, source: 'fallback' })).toBe(
      'Refresh failed — using bundled prices · 2026-08-19'
    );
  });
});

describe('makeCostTransformation', () => {
  const frames = [
    seriesFrame({ model: 'gpt-5.3-codex', token_type: 'input' }, [1_000_000]),
    seriesFrame({ model: 'gpt-5.3-codex', token_type: 'cached_input' }, [800_000]),
    seriesFrame({ model: 'gpt-5.3-codex', token_type: 'output' }, [50_000]),
    seriesFrame({ model: 'codex-auto-review', token_type: 'input' }, [400_000]),
    seriesFrame({ model: 'codex-auto-review', token_type: 'output' }, [1_000] ),
  ];

  it('emits the estimated cost as a single USD value', async () => {
    const [frame] = await runTransform(frames, TABLE, 'cost');

    expect(frame.fields).toHaveLength(1);
    expect(frame.fields[0].name).toBe(COST_FIELD_NAME);
    expect(frame.fields[0].values[0]).toBeCloseTo(1.19, 10);
  });

  it('emits unpriced token volume as its own value', async () => {
    const [frame] = await runTransform(frames, TABLE, 'unpriced');

    expect(frame.fields[0].name).toBe(UNPRICED_FIELD_NAME);
    expect(frame.fields[0].values[0]).toBe(401_000);
  });

  it('emits table provenance as readable text', async () => {
    const [frame] = await runTransform(frames, { ...TABLE, source: 'fallback' }, 'provenance');

    expect(frame.fields[0].name).toBe(PROVENANCE_FIELD_NAME);
    expect(frame.fields[0].values[0]).toBe('Refresh failed — using bundled prices · 2026-08-19');
  });

  it('renders empty rather than throwing when the range holds no Codex data', async () => {
    const [frame] = await runTransform([], TABLE, 'cost');

    expect(frame.fields[0].values[0]).toBe(0);
    expect(frame.length).toBe(1);
  });

  it('still reports provenance when there is no data at all', async () => {
    const [frame] = await runTransform([], { ...TABLE, source: 'fallback' }, 'provenance');

    expect(frame.fields[0].values[0]).toContain('Refresh failed');
  });

  it('does not let a token_type="total" series inflate the cost', async () => {
    const withTotal = [...frames, seriesFrame({ model: 'gpt-5.3-codex', token_type: 'total' }, [1_050_000])];
    const [frame] = await runTransform(withTotal, TABLE, 'cost');

    expect(frame.fields[0].values[0]).toBeCloseTo(1.19, 10);
  });
});
