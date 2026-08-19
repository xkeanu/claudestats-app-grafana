import { DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { CustomTransformOperator } from '@grafana/scenes';
import { map, switchMap } from 'rxjs/operators';
import { from, Observable } from 'rxjs';
import { estimateCost, TokenRow } from './estimateCost';
import { PriceTable, resolvePriceTable } from './priceTable';
import { getPluginSettings } from './settings';

export const COST_FIELD_NAME = 'Estimated cost';
export const UNPRICED_FIELD_NAME = 'Unpriced tokens';
export const PROVENANCE_FIELD_NAME = 'Price table';
export const BLENDED_FIELD_NAME = 'Total cost (incl. estimate)';

export type CostOutput = 'cost' | 'unpriced' | 'provenance';

/**
 * Flattens the `sum by (model, token_type)` response into rows.
 *
 * The expression uses `increase(...[$__range])`, which is cumulative across the
 * selected window, so the last point of each series is the window total — the
 * same reduction the surrounding stat panels apply.
 */
/**
 * Keeps only the series still reporting at the end of the window.
 *
 * Grafana's Prometheus datasource returns one frame per series with its OWN
 * time axis — it does not pad them onto a shared grid — so a frame's own last
 * point says nothing about whether that series is still live. A series that
 * stopped mid-window has an increase of zero over the trailing window; taking
 * its last recorded total instead counts old usage as current. On live 30d
 * data that revived gpt-5.3-codex-spark, idle for 20 days, and inflated
 * unpriced volume from 68.9M to 80.5M.
 */
function liveFrames(frames: DataFrame[]): DataFrame[] {
  let windowEnd = Number.NEGATIVE_INFINITY;
  for (const frame of frames) {
    const time = frame.fields.find((field) => field.type === FieldType.time);
    const last = time?.values[time.values.length - 1];
    if (typeof last === 'number' && Number.isFinite(last)) {
      windowEnd = Math.max(windowEnd, last);
    }
  }

  return frames.filter((frame) => {
    const time = frame.fields.find((field) => field.type === FieldType.time);
    const lastTs = time?.values[time.values.length - 1];
    if (typeof lastTs !== 'number' || !Number.isFinite(lastTs)) {
      return true;
    }

    // Two steps of slack absorbs ordinary scrape jitter without admitting a
    // series that stopped days ago.
    const step = time!.values.length > 1 ? Math.abs(time!.values[1] - time!.values[0]) : 0;
    return windowEnd - lastTs <= 2 * step;
  });
}

export function codexTokenRowsFromFrames(frames: DataFrame[]): TokenRow[] {
  const rows: TokenRow[] = [];

  for (const frame of liveFrames(frames)) {
    for (const field of frame.fields) {
      if (field.type !== FieldType.number) {
        continue;
      }

      const model = field.labels?.model;
      const tokenType = field.labels?.token_type;
      if (model === undefined || tokenType === undefined) {
        continue;
      }

      const tokens = field.values[field.values.length - 1];
      if (typeof tokens === 'number' && Number.isFinite(tokens)) {
        rows.push({ model, token_type: tokenType, tokens });
      }
    }
  }

  return rows;
}

/**
 * Sums the measured (Claude) cost series.
 *
 * The partition between measured and estimated is by LABEL, not by refId or
 * position: a Codex token series carries `model` and `token_type`, a cost
 * series carries neither. Getting this wrong would add token counts to a
 * dollar figure — millions of dollars, not a rounding error.
 */
export function measuredCostFromFrames(frames: DataFrame[]): number {
  let total = 0;

  for (const frame of liveFrames(frames)) {
    for (const field of frame.fields) {
      if (field.type !== FieldType.number || field.labels?.token_type !== undefined) {
        continue;
      }

      const value = field.values[field.values.length - 1];
      if (typeof value === 'number' && Number.isFinite(value)) {
        total += value;
      }
    }
  }

  return total;
}

/**
 * One line of text saying which table produced the figures.
 *
 * `fallback` reads differently from `snapshot` on purpose. Both serve bundled
 * prices, but a blocked refresh must not be presentable as a deliberate
 * default — a viewer who enabled live refresh needs to know it did not happen.
 */
export function describePriceTable(table: PriceTable): string {
  switch (table.source) {
    case 'live':
      return `Live prices · ${table.asOf}`;
    case 'fallback':
      return `Refresh failed — using bundled prices · ${table.asOf}`;
    default:
      return `Bundled prices · ${table.asOf}`;
  }
}

function buildFrame(output: CostOutput, frames: DataFrame[], table: PriceTable): DataFrame[] {
  if (output === 'provenance') {
    return [
      toDataFrame({
        fields: [{ name: PROVENANCE_FIELD_NAME, type: FieldType.string, values: [describePriceTable(table)] }],
      }),
    ];
  }

  const { estimatedCostUsd, unpricedTokens } = estimateCost(codexTokenRowsFromFrames(frames), table);

  return output === 'cost'
    ? [toDataFrame({ fields: [{ name: COST_FIELD_NAME, type: FieldType.number, values: [estimatedCostUsd] }] })]
    : [toDataFrame({ fields: [{ name: UNPRICED_FIELD_NAME, type: FieldType.number, values: [unpricedTokens] }] })];
}

/**
 * Scenes transformation applying the price table to the token query.
 *
 * `resolve` is injectable for tests; in the app it reads the memoised table, so
 * the several panels carrying cost across three views share one resolution and,
 * when live refresh is on, one request.
 *
 * An empty range yields a zero rather than an absent frame: a stat panel with
 * no frame renders "No data", which reads as breakage rather than as the
 * honest "no Codex usage in this window".
 */
/**
 * Claude's measured cost plus the Codex estimate, from one query runner
 * carrying both queries.
 *
 * Blending is what closes the asymmetry this feature exists to fix: token
 * counts were already dual-tool while cost was Claude-only, so every dollar of
 * Codex spend read as $0. The blended figure is marked as containing an
 * estimated component everywhere it appears.
 */
export function makeBlendedCostTransformation(
  resolve: () => Promise<PriceTable> = () => resolvePriceTable(getPluginSettings())
): CustomTransformOperator {
  return () => (source: Observable<DataFrame[]>) =>
    source.pipe(
      switchMap((frames) =>
        from(resolve()).pipe(
          map((table) => {
            const measured = measuredCostFromFrames(frames);
            const { estimatedCostUsd } = estimateCost(codexTokenRowsFromFrames(frames), table);

            return [
              toDataFrame({
                fields: [
                  {
                    name: BLENDED_FIELD_NAME,
                    type: FieldType.number,
                    values: [measured + estimatedCostUsd],
                  },
                ],
              }),
            ];
          })
        )
      )
    );
}

export function makeCostTransformation(
  output: CostOutput,
  resolve: () => Promise<PriceTable> = () => resolvePriceTable(getPluginSettings())
): CustomTransformOperator {
  return () => (source: Observable<DataFrame[]>) =>
    source.pipe(switchMap((frames) => from(resolve()).pipe(map((table) => buildFrame(output, frames, table)))));
}
