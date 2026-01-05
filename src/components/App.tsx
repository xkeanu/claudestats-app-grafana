import React from 'react';
import { AppRootProps } from '@grafana/data';
import { ClaudeStatsApp } from './scenes/SceneAppPage';

export function App(_props: AppRootProps) {
  return <ClaudeStatsApp />;
}
