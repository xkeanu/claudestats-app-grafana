import { MODEL_FAMILIES, OTHER_FAMILY } from '../../constants';

/**
 * Colour semantics — the single definition point for every series colour this
 * app fixes by hand (REQ-008).
 *
 * Everything else is coloured by Grafana's `palette-classic-by-name` mode,
 * which derives a colour from the series NAME rather than its index, so a name
 * keeps its colour across panels, pages, and reloads (REQ-007), and whose
 * palette getter already filters to colours meeting the active theme's
 * contrast threshold (REQ-009). Nothing here re-implements either.
 *
 * Values are Grafana NAMED palette colours, never hex literals: a name is
 * resolved per theme, so `green` reads correctly in light and dark, while a
 * hex literal is frozen to whichever theme it was picked in.
 */

/**
 * Prefix every residual (clustered "rest of the series") name starts with.
 *
 * Exported so callers can detect a residual by name without re-deriving the
 * format — the count varies per panel and per refresh, so an equality check
 * against a fixed string would never match.
 */
export const RESIDUAL_SERIES_PREFIX = 'Other';

/**
 * Name for the residual series aggregating `count` underlying series.
 *
 * The count is part of the name because a bare "Other" hides whether it stands
 * for 2 series or 40 (REQ-004).
 */
export function residualSeriesName(count: number): string {
  return count === 1 ? `${RESIDUAL_SERIES_PREFIX} (1 more)` : `${RESIDUAL_SERIES_PREFIX} (${count} more)`;
}

/** True when `name` was produced by {@link residualSeriesName}. */
export function isResidualSeriesName(name: string): boolean {
  return /^Other \(\d+ more\)$/.test(name);
}

/**
 * Provider family colours, keyed by the family's stable `key` — never by its
 * `display` string.
 *
 * Display names are read back out of `MODEL_FAMILIES` below, so renaming a
 * family's display text in CAG-3's rule table carries its colour along instead
 * of silently orphaning it. Keying this map by display would reintroduce
 * exactly the drift CAG-3's single-definition-point rule exists to prevent.
 */
const PROVIDER_FAMILY_COLORS_BY_KEY: Record<string, string> = {
  claude: 'purple',
  gpt: 'green',
  glm: 'blue',
  review: 'yellow',
  [OTHER_FAMILY.key]: 'gray',
};

/**
 * Fallback for a family added to `MODEL_FAMILIES` without a colour named here.
 * Better a readable neutral than an undefined lookup.
 */
const UNASSIGNED_FAMILY_COLOR = 'darkgray';

/** Series names carrying an established meaning, and the colour each must keep. */
export const SEMANTIC_SERIES_COLORS: Record<string, string> = {
  // Provider families, read from the CAG-3 rule table.
  ...Object.fromEntries(
    [...MODEL_FAMILIES, OTHER_FAMILY].map((family) => [
      family.display,
      PROVIDER_FAMILY_COLORS_BY_KEY[family.key] ?? UNASSIGNED_FAMILY_COLOR,
    ])
  ),

  // Tool decisions (claude_code_code_edit_tool_decision_total).
  accept: 'green',
  reject: 'red',
  // Codex guardian review uses the same pair under different words.
  approved: 'green',
  denied: 'red',

  // Lines of code (claude_code_lines_of_code_count_total).
  added: 'green',
  removed: 'red',
};

/**
 * Colour the residual bucket always renders in — deliberately recessive.
 *
 * `gray` resolves to #808080 in both themes, so it stays legible against a
 * light and a dark panel background while reading as muted next to the
 * saturated palette hues.
 *
 * It must be a name Grafana can actually resolve. Theme text tokens such as
 * `text-disabled` look like valid names and are not: `getColorByName` returns
 * an unknown name unchanged, and the panel then throws
 * "Unsupported 'text-disabled' color" when it computes a fill alpha.
 */
export const RESIDUAL_SERIES_COLOR = 'gray';

/**
 * Semantic colour for `name`, or undefined when it should fall through to the
 * name-derived palette colour.
 *
 * Residual names are matched by shape rather than by lookup, since the count
 * they carry makes every one of them a distinct string.
 */
export function semanticColorFor(name: string): string | undefined {
  if (isResidualSeriesName(name)) {
    return RESIDUAL_SERIES_COLOR;
  }
  return SEMANTIC_SERIES_COLORS[name];
}
