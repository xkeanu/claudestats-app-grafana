import React from 'react';
import {
  SceneApp,
  SceneAppPage,
  SceneTimeRange,
  useSceneApp,
} from '@grafana/scenes';
import { PLUGIN_BASE_URL, ROUTES } from '../../constants';
import { getSharedVariables } from '../../scenes/variables';
import { getOverviewScene } from '../../scenes/pages/OverviewScene';
import { getCostsScene } from '../../scenes/pages/CostsScene';
import { getTokensScene } from '../../scenes/pages/TokensScene';
import { getToolsScene } from '../../scenes/pages/ToolsScene';
import { getProductivityScene } from '../../scenes/pages/ProductivityScene';
import { getLanguagesScene } from '../../scenes/pages/LanguagesScene';
import { getEnvironmentScene } from '../../scenes/pages/EnvironmentScene';

// Helper to prefix route with plugin base URL
function prefixRoute(route: string): string {
  return `${PLUGIN_BASE_URL}/${route}`;
}

function getSceneApp() {
  const timeRange = new SceneTimeRange({ from: 'now-7d', to: 'now' });
  const variables = getSharedVariables();

  return new SceneApp({
    pages: [
      new SceneAppPage({
        title: 'Claude Code Stats',
        subTitle: 'Team usage analytics for Claude Code',
        url: PLUGIN_BASE_URL,
        routePath: '*',
        getScene: () => getOverviewScene(timeRange, variables),
        tabs: [
          new SceneAppPage({
            title: 'Overview',
            url: PLUGIN_BASE_URL,
            routePath: '/',
            getScene: () => getOverviewScene(timeRange, variables),
          }),
          new SceneAppPage({
            title: 'Costs',
            url: prefixRoute(ROUTES.Costs),
            routePath: `/${ROUTES.Costs}`,
            getScene: () => getCostsScene(timeRange, variables),
          }),
          new SceneAppPage({
            title: 'Tokens',
            url: prefixRoute(ROUTES.Tokens),
            routePath: `/${ROUTES.Tokens}`,
            getScene: () => getTokensScene(timeRange, variables),
          }),
          new SceneAppPage({
            title: 'Tools',
            url: prefixRoute(ROUTES.Tools),
            routePath: `/${ROUTES.Tools}`,
            getScene: () => getToolsScene(timeRange, variables),
          }),
          new SceneAppPage({
            title: 'Productivity',
            url: prefixRoute(ROUTES.Productivity),
            routePath: `/${ROUTES.Productivity}`,
            getScene: () => getProductivityScene(timeRange, variables),
          }),
          new SceneAppPage({
            title: 'Languages',
            url: prefixRoute(ROUTES.Languages),
            routePath: `/${ROUTES.Languages}`,
            getScene: () => getLanguagesScene(timeRange, variables),
          }),
          new SceneAppPage({
            title: 'Environment',
            url: prefixRoute(ROUTES.Environment),
            routePath: `/${ROUTES.Environment}`,
            getScene: () => getEnvironmentScene(timeRange, variables),
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

function SceneAppRenderer() {
  const scene = useSceneApp(() => getSceneApp());
  return <scene.Component model={scene} />;
}

export function ClaudeStatsApp() {
  return <SceneAppRenderer />;
}
