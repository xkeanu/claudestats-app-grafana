# Changelog

## 1.0.1

### Changed

- Use `user_email` label instead of `user_account_uuid` for team member identification
- Added `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative` to setup guide (required for Grafana Cloud)
- Improved browser tab titles for better navigation
- Simplified configuration page (removed Team Members tab, users are now identified by email automatically)

### Added

- End-to-end tests with Playwright
- `.nvmrc` file for consistent Node.js version

### CI

- Bump actions/checkout from 5 to 6
- Bump actions/setup-node from 6.0.0 to 6.1.0
- Bump actions/upload-artifact from 5 to 6
- Bump actions/download-artifact from 6 to 7
- Bump grafana/plugin-actions/bundle-size from 1.0.2 to 1.1.0

## 1.0.0

Initial release of Claude Stats Grafana app plugin.

### Features

- Overview dashboard with cost, token, and session metrics
- Cost analytics with breakdown by model and team member
- Token usage analysis with input/output/cache breakdown
- Tool usage tracking with accept/reject decisions
- Productivity metrics (lines of code, commits, PRs)
- Setup wizard for configuring Claude Code OpenTelemetry export
- Team member filtering across all dashboards
- Auto-discovery of Prometheus data sources
