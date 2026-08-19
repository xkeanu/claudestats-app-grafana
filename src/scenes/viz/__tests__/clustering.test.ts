import { DataFrame, FieldType } from '@grafana/data';
import { of } from 'rxjs';

import { isResidualSeriesName, residualSeriesName } from '../palette';
import { clusterFrames, clusterSeries, seriesNameOf } from '../clustering';

/** A two-field (time, value) frame, the shape the Prometheus datasource returns. */
function frame(name: string, values: Array<number | null>, times?: number[]): DataFrame {
  const timeValues = times ?? values.map((_, index) => index * 1000);
  return {
    name,
    refId: name,
    length: values.length,
    fields: [
      { name: 'Time', type: FieldType.time, config: {}, values: timeValues },
      { name: 'Value', type: FieldType.number, config: {}, values },
    ],
  };
}

/** N frames whose totals descend, so rank order is unambiguous. */
function descendingFrames(count: number, points = 3): DataFrame[] {
  return Array.from({ length: count }, (_, index) =>
    frame(`series-${index}`, Array.from({ length: points }, () => count - index))
  );
}

/** Sum of every numeric value at time index `i` across `frames`. */
function totalAt(frames: DataFrame[], index: number): number {
  return frames.reduce((sum, f) => {
    const value = f.fields[1]?.values[index];
    return sum + (typeof value === 'number' ? value : 0);
  }, 0);
}

describe('clusterFrames — additive mode', () => {
  it('keeps the top N and folds the remainder into exactly one residual frame', () => {
    const out = clusterFrames(descendingFrames(12), { limit: 8, mode: 'additive' });

    expect(out).toHaveLength(9);
    expect(out.slice(0, 8).map(seriesNameOf)).toEqual([
      'series-0',
      'series-1',
      'series-2',
      'series-3',
      'series-4',
      'series-5',
      'series-6',
      'series-7',
    ]);
    expect(isResidualSeriesName(seriesNameOf(out[8]))).toBe(true);
  });

  it('preserves the panel total at every time index (REQ-003)', () => {
    const input = descendingFrames(12, 4);
    const out = clusterFrames(input, { limit: 8, mode: 'additive' });

    for (let index = 0; index < 4; index++) {
      expect(totalAt(out, index)).toBe(totalAt(input, index));
    }
  });

  it('names the residual with the number of series it aggregates (REQ-004)', () => {
    const out = clusterFrames(descendingFrames(12), { limit: 8, mode: 'additive' });
    expect(seriesNameOf(out[8])).toBe(residualSeriesName(4));
  });

  it('ranks by whole-range total, not by the value at any single timestamp (REQ-002)', () => {
    // `spike` is by far the largest series at index 0 (100 vs 40/40/60) but
    // ranks last over the whole range (100 vs 160/160/240). Per-timestamp
    // ranking would keep it; whole-range ranking must not.
    const input = [
      frame('steady-a', [40, 40, 40, 40]),
      frame('steady-b', [40, 40, 40, 40]),
      frame('spike', [100, 0, 0, 0]),
      frame('steady-c', [60, 60, 60, 60]),
    ];
    const out = clusterFrames(input, { limit: 3, mode: 'additive' });
    const kept = out.slice(0, 3).map(seriesNameOf);

    expect(kept).toEqual(['steady-c', 'steady-a', 'steady-b']);
    expect(kept).not.toContain('spike');
  });

  it('keeps membership constant across every time index of one render (REQ-002)', () => {
    const input = [
      frame('a', [0, 0, 90]),
      frame('b', [90, 0, 0]),
      frame('c', [1, 1, 1]),
      frame('d', [1, 1, 1]),
    ];
    const out = clusterFrames(input, { limit: 2, mode: 'additive' });
    const kept = out.slice(0, 2).map(seriesNameOf);

    // The same two names carry every time index — nothing appears or vanishes
    // mid-chart, which is what ruled out PromQL topk().
    for (let index = 0; index < 3; index++) {
      expect(out.slice(0, 2).map(seriesNameOf)).toEqual(kept);
    }
  });

  it('passes frames through untouched and emits no residual at or below the limit (REQ-005)', () => {
    const input = descendingFrames(5);
    const out = clusterFrames(input, { limit: 8, mode: 'additive' });

    expect(out).toHaveLength(5);
    expect(out).toEqual(input);
    expect(out.some((f) => isResidualSeriesName(seriesNameOf(f)))).toBe(false);
  });

  it('emits no residual when the series count exactly equals the limit (REQ-005)', () => {
    const out = clusterFrames(descendingFrames(8), { limit: 8, mode: 'additive' });
    expect(out).toHaveLength(8);
    expect(out.some((f) => isResidualSeriesName(seriesNameOf(f)))).toBe(false);
  });

  it('returns empty output for empty input, with no residual', () => {
    expect(clusterFrames([], { limit: 8, mode: 'additive' })).toEqual([]);
  });

  it('ranks an all-null frame as zero but still counts it toward the series total', () => {
    const input = [...descendingFrames(8), frame('all-null', [null, null, null])];
    const out = clusterFrames(input, { limit: 8, mode: 'additive' });

    expect(out).toHaveLength(9);
    expect(seriesNameOf(out[8])).toBe(residualSeriesName(1));
    expect(out.slice(0, 8).map(seriesNameOf)).not.toContain('all-null');
  });

  it('ranks a frame with no numeric field as zero but still counts it', () => {
    const noValue: DataFrame = {
      name: 'no-numeric',
      length: 0,
      fields: [{ name: 'Time', type: FieldType.time, config: {}, values: [0, 1000] }],
    };
    const out = clusterFrames([...descendingFrames(8), noValue], { limit: 8, mode: 'additive' });

    expect(out).toHaveLength(9);
    expect(seriesNameOf(out[8])).toBe(residualSeriesName(1));
  });

  it('aligns frames of differing length by time index when summing the residual', () => {
    const input = [
      ...descendingFrames(2, 4),
      frame('short', [1, 1]),
      frame('long', [1, 1, 1, 1]),
    ];
    const out = clusterFrames(input, { limit: 2, mode: 'additive' });
    const residual = out[2];

    expect(residual.fields[1].values).toEqual([2, 2, 1, 1]);
  });

  it('treats a null inside an otherwise populated frame as a zero contribution', () => {
    // `gappy` and `other` rank below the limit, so both land in the residual.
    // The null at index 1 must contribute nothing rather than poisoning the sum.
    const input = [
      frame('big-a', [50, 50, 50]),
      frame('big-b', [40, 40, 40]),
      frame('gappy', [5, null, 5]),
      frame('other', [1, 1, 1]),
    ];
    const out = clusterFrames(input, { limit: 2, mode: 'additive' });

    expect(out.slice(0, 2).map(seriesNameOf)).toEqual(['big-a', 'big-b']);
    expect(out[2].fields[1].values).toEqual([6, 1, 6]);
  });
});

describe('clusterFrames — ratio mode', () => {
  it('truncates to the limit and emits no residual (REQ-014)', () => {
    const out = clusterFrames(descendingFrames(12), { limit: 8, mode: 'ratio' });

    expect(out).toHaveLength(8);
    expect(out.some((f) => isResidualSeriesName(seriesNameOf(f)))).toBe(false);
  });

  it('passes through unchanged at or below the limit', () => {
    const input = descendingFrames(5);
    expect(clusterFrames(input, { limit: 8, mode: 'ratio' })).toEqual(input);
  });

  it('returns empty output for empty input', () => {
    expect(clusterFrames([], { limit: 8, mode: 'ratio' })).toEqual([]);
  });
});

describe('clusterSeries operator', () => {
  it('applies clustering to the frames flowing through it', (done) => {
    const operator = clusterSeries({ limit: 8, mode: 'additive' });
    const stream = operator({} as never)(of(descendingFrames(12)));

    stream.subscribe((out) => {
      expect(out).toHaveLength(9);
      expect(isResidualSeriesName(seriesNameOf(out[8]))).toBe(true);
      done();
    });
  });
});

describe('seriesNameOf', () => {
  it('prefers the frame name the datasource set from legendFormat', () => {
    expect(seriesNameOf(frame('my-macbook', [1]))).toBe('my-macbook');
  });

  it('falls back to the value field display name when the frame is unnamed', () => {
    const f = frame('', [1]);
    f.name = undefined;
    f.fields[1].config = { displayNameFromDS: 'from-ds' };
    expect(seriesNameOf(f)).toBe('from-ds');
  });
});
