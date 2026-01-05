import { getBackendSrv } from '@grafana/runtime';
import { SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { PLUGIN_ID } from '../constants';
import { ClaudeStatsSettings, parseTeamMembers } from '../types';

let cachedTeamMembers: Record<string, string> | null = null;

/**
 * Load team member mappings from plugin settings
 * Parses the teamMembers string (UUID|Name format) into a dictionary
 */
export async function loadTeamMembers(): Promise<Record<string, string>> {
  if (cachedTeamMembers !== null) {
    return cachedTeamMembers;
  }

  try {
    const response = await getBackendSrv().get(`/api/plugins/${PLUGIN_ID}/settings`);
    const jsonData = response.jsonData as ClaudeStatsSettings | undefined;
    cachedTeamMembers = parseTeamMembers(jsonData?.teamMembers || '');
    return cachedTeamMembers;
  } catch (e) {
    console.error('Error loading team member settings:', e);
    cachedTeamMembers = {};
    return cachedTeamMembers;
  }
}

/**
 * Clear the cached team members (useful after saving new settings)
 */
export function clearTeamMembersCache(): void {
  cachedTeamMembers = null;
}

/**
 * Get team member display name from UUID
 * Returns the UUID if no mapping is found
 */
export function getTeamMemberName(uuid: string, mappings: Record<string, string>): string {
  return mappings[uuid] || uuid;
}

/**
 * Create rename transformations for team member UUIDs
 * This creates a series of renameByRegex transformations
 */
export function createTeamMemberRenameTransformations(mappings: Record<string, string>): Array<{
  id: string;
  options: { regex: string; renamePattern: string };
}> {
  return Object.entries(mappings).map(([uuid, name]) => ({
    id: 'renameByRegex',
    options: {
      regex: `(.*)${escapeRegex(uuid)}(.*)`,
      renamePattern: `$1${name}$2`,
    },
  }));
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wrap a SceneQueryRunner with transformations to rename team member UUIDs
 */
export function withTeamMemberNames(
  queryRunner: SceneQueryRunner,
  teamMembers: Record<string, string>
): SceneDataTransformer {
  const transformations = createTeamMemberRenameTransformations(teamMembers);

  return new SceneDataTransformer({
    $data: queryRunner,
    transformations: transformations,
  });
}
