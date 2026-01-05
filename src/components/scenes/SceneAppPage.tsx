import React, { useEffect, useState } from 'react';
import {
  SceneApp,
  SceneAppPage,
  SceneTimeRange,
  useSceneApp,
} from '@grafana/scenes';
import { LoadingPlaceholder } from '@grafana/ui';
import { PLUGIN_BASE_URL, ROUTES } from '../../constants';
import { getSharedVariables } from '../../scenes/variables';
import { getOverviewScene } from '../../scenes/pages/OverviewScene';
import { getCostsScene } from '../../scenes/pages/CostsScene';
import { getTokensScene } from '../../scenes/pages/TokensScene';
import { getToolsScene } from '../../scenes/pages/ToolsScene';
import { getProductivityScene } from '../../scenes/pages/ProductivityScene';
import { loadTeamMembers } from '../../utils/teamMembers';

// Helper to prefix route with plugin base URL
function prefixRoute(route: string): string {
  return `${PLUGIN_BASE_URL}/${route}`;
}

function getSceneApp(teamMembers: Record<string, string>) {
  const timeRange = new SceneTimeRange({ from: 'now-7d', to: 'now' });
  const variables = getSharedVariables();

  return new SceneApp({
    pages: [
      new SceneAppPage({
        title: 'Claude Stats',
        subTitle: 'Team usage analytics for Claude Code',
        url: PLUGIN_BASE_URL,
        // Use wildcard to match all sub-routes
        routePath: '*',
        hideFromBreadcrumbs: true,
        getScene: () => getOverviewScene(timeRange, variables, teamMembers),
        tabs: [
          new SceneAppPage({
            title: 'Overview',
            url: PLUGIN_BASE_URL,
            // Default tab uses '/'
            routePath: '/',
            getScene: () => getOverviewScene(timeRange, variables, teamMembers),
          }),
          new SceneAppPage({
            title: 'Costs',
            url: prefixRoute(ROUTES.Costs),
            routePath: `/${ROUTES.Costs}`,
            getScene: () => getCostsScene(timeRange, variables, teamMembers),
          }),
          new SceneAppPage({
            title: 'Tokens',
            url: prefixRoute(ROUTES.Tokens),
            routePath: `/${ROUTES.Tokens}`,
            getScene: () => getTokensScene(timeRange, variables, teamMembers),
          }),
          new SceneAppPage({
            title: 'Tools',
            url: prefixRoute(ROUTES.Tools),
            routePath: `/${ROUTES.Tools}`,
            getScene: () => getToolsScene(timeRange, variables, teamMembers),
          }),
          new SceneAppPage({
            title: 'Productivity',
            url: prefixRoute(ROUTES.Productivity),
            routePath: `/${ROUTES.Productivity}`,
            getScene: () => getProductivityScene(timeRange, variables, teamMembers),
          }),
        ],
      }),
    ],
    urlSyncOptions: {
      updateUrlOnInit: true,
      createBrowserHistorySteps: true,
    },
  });
}

function SceneAppRenderer({ teamMembers }: { teamMembers: Record<string, string> }) {
  const scene = useSceneApp(() => getSceneApp(teamMembers));
  return <scene.Component model={scene} />;
}

export function ClaudeStatsApp() {
  const [teamMembers, setTeamMembers] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTeamMembers()
      .then(setTeamMembers)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading || teamMembers === null) {
    return <LoadingPlaceholder text="Loading Claude Stats..." />;
  }

  return <SceneAppRenderer teamMembers={teamMembers} />;
}
