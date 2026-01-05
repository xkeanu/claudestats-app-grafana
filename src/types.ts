/**
 * Plugin JSON data stored in Grafana
 */
export interface ClaudeStatsSettings {
  /** Team member UUID to display name mappings (raw string format: UUID|Name per line) */
  teamMembers?: string;
}

/**
 * Parse team member mappings from raw textarea input
 * Format: UUID|Name (one per line)
 * Example:
 *   abc-123|John Smith
 *   def-456|Jane Doe
 */
export function parseTeamMembers(raw: string): Record<string, string> {
  const mappings: Record<string, string> = {};

  if (!raw) {
    return mappings;
  }

  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue; // Skip empty lines and comments
    }

    const separatorIndex = trimmed.indexOf('|');
    if (separatorIndex > 0) {
      const uuid = trimmed.substring(0, separatorIndex).trim();
      const name = trimmed.substring(separatorIndex + 1).trim();
      if (uuid && name) {
        mappings[uuid] = name;
      }
    }
  }

  return mappings;
}

/**
 * Format team member mappings back to raw textarea format
 */
export function formatTeamMembers(mappings: Record<string, string>): string {
  return Object.entries(mappings)
    .map(([uuid, name]) => `${uuid}|${name}`)
    .join('\n');
}
