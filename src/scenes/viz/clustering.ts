import { DataFrame, Field, FieldType } from '@grafana/data';
import { CustomTransformOperator } from '@grafana/scenes';
import { map } from 'rxjs/operators';

import { residualSeriesName } from './palette';

/**
 * Top-N-plus-residual series clustering, as a Scenes transformation.
 *
 * Clustering runs AFTER the query, on the frames Prometheus returned. That
 * ordering is the whole design:
 *
 *  - Ranking happens once over the whole range, so a series' membership in the
 *    displayed set is constant for every time step of one render (REQ-002).
 *    PromQL `topk()` cannot do this — Prometheus evaluates it independently at
 *    every step, so series flicker in and out mid-chart.
 *  - The query layer is untouched, so clustering composes automatically with
 *    the six filter variables and with CAG-3's `label_replace` provider chain.
 *    Narrowing `$device` to one device shows that device, not a residual bucket
 *    computed before the filter (REQ-006) — that falls out of the ordering.
 *  - The residual is a plain sum, so the panel total is preserved exactly
 *    (REQ-003) rather than approximately.
 */

export type ClusterMode =
  /** Additive quantity: fold the remainder into one residual series (REQ-001). */
  | 'additive'
  /** Ratio or percentage: truncate to the limit, no residual (REQ-014). */
  | 'ratio';

export interface ClusterOptions {
  /** Maximum number of individually drawn series, before any residual. */
  limit: number;
  mode: ClusterMode;
}

/**
 * Display name of the series a frame carries.
 *
 * The Prometheus datasource puts the interpolated `legendFormat` on the frame
 * name; `displayNameFromDS` on the value field is the fallback for frames the
 * datasource named field-side instead.
 */
export function seriesNameOf(frame: DataFrame): string {
  if (frame.name) {
    return frame.name;
  }
  const valueField = numericFieldOf(frame);
  return valueField?.config?.displayNameFromDS ?? valueField?.name ?? '';
}

/** First non-time numeric field — the one carrying the series' values. */
function numericFieldOf(frame: DataFrame): Field | undefined {
  return frame.fields.find((field) => field.type === FieldType.number);
}

/**
 * Whole-range total for a frame.
 *
 * Nulls and non-numeric values contribute zero, so a frame that is all-null or
 * carries no numeric field at all ranks as zero — but it is still one of the
 * frames being ranked, so it counts toward the distinct-series total and lands
 * in the residual rather than silently vanishing.
 *
 * Ranking by raw sum without an absolute-value step is safe here: every
 * additive panel in scope plots `increase()` over a counter or a rate derived
 * from one, so values are non-negative.
 */
function rangeTotal(frame: DataFrame): number {
  const values = numericFieldOf(frame)?.values;
  if (!values) {
    return 0;
  }
  let total = 0;
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      total += value;
    }
  }
  return total;
}

/**
 * Sum the dropped frames into one residual frame, keyed by TIMESTAMP.
 *
 * Summing the nth sample of each frame would be wrong. The Prometheus
 * datasource returns one frame per series with its own time axis and does not
 * pad them onto a shared grid, so a series that first appears mid-window — a
 * new version, device or language, which is precisely the long tail being
 * clustered — starts at index 0 with a much later timestamp. Adding index to
 * index credits that sample to the start of the range and drops the samples
 * past the longest frame's length, breaking REQ-003 at every step.
 *
 * The residual therefore spans the union of the dropped frames' timestamps.
 * A timestamp seen only as a null or non-numeric sample stays null rather than
 * being reported as a real zero.
 */
function buildResidualFrame(dropped: DataFrame[]): DataFrame {
  const byTimestamp = new Map<number, number | null>();

  for (const frame of dropped) {
    const times = frame.fields.find((field) => field.type === FieldType.time)?.values;
    const values = numericFieldOf(frame)?.values;
    if (!times || !values) {
      continue;
    }

    const samples = Math.min(times.length, values.length);
    for (let index = 0; index < samples; index++) {
      const time = times[index];
      if (typeof time !== 'number') {
        continue;
      }
      const value = values[index];
      if (typeof value === 'number' && Number.isFinite(value)) {
        byTimestamp.set(time, (byTimestamp.get(time) ?? 0) + value);
      } else if (!byTimestamp.has(time)) {
        byTimestamp.set(time, null);
      }
    }
  }

  const timeValues = [...byTimestamp.keys()].sort((a, b) => a - b);
  const sums = timeValues.map((time) => byTimestamp.get(time) ?? null);
  const name = residualSeriesName(dropped.length);

  return {
    name,
    refId: name,
    length: timeValues.length,
    fields: [
      { name: 'Time', type: FieldType.time, config: {}, values: timeValues },
      {
        name: 'Value',
        type: FieldType.number,
        config: { displayNameFromDS: name },
        values: sums,
      },
    ],
  };
}

/**
 * Rank `frames` by whole-range total and reduce them to at most `limit`
 * individually drawn series.
 *
 * Exported separately from the operator so the behaviour is testable against
 * plain `DataFrame[]` with no Scenes runtime.
 */
export function clusterFrames(frames: DataFrame[], { limit, mode }: ClusterOptions): DataFrame[] {
  if (frames.length <= limit) {
    // At or below the limit every series is drawn and no residual is produced
    // (REQ-005). Returning the input array itself keeps the no-op cheap.
    return frames;
  }

  // Rank once, over the whole range. `index` breaks ties so the order is
  // stable across refreshes rather than dependent on the sort implementation.
  const ranked = frames
    .map((frame, index) => ({ frame, index, total: rangeTotal(frame) }))
    .sort((a, b) => b.total - a.total || a.index - b.index);

  const kept = ranked.slice(0, limit).map((entry) => entry.frame);

  if (mode === 'ratio') {
    // Summing percentages into a bucket produces a number that means nothing,
    // so the tail is dropped rather than aggregated (REQ-014).
    return kept;
  }

  return [...kept, buildResidualFrame(ranked.slice(limit).map((entry) => entry.frame))];
}

/**
 * The Scenes transformation. Attach via `SceneDataTransformer` between a
 * `SceneQueryRunner` and its panel.
 */
export function clusterSeries(options: ClusterOptions): CustomTransformOperator {
  return () => (source) => source.pipe(map((frames: DataFrame[]) => clusterFrames(frames, options)));
}
