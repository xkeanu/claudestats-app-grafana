import React from 'react';
import { AppRootProps } from '@grafana/data';
import { ClaudeStatsApp } from './scenes/SceneAppPage';
import { ClaudeStatsSettings } from '../types';
import { setPluginSettings } from '../pricing/settings';

export function App(props: AppRootProps<ClaudeStatsSettings>) {
  // The app root is the only place jsonData is available — config.apps in
  // @grafana/runtime carries no jsonData — so capture it here for the scene
  // builders that need the price settings.
  setPluginSettings(props.meta?.jsonData);

  return <ClaudeStatsApp />;
}
