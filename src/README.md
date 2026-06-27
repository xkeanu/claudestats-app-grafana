# Coding Tool Stats

Team usage analytics for Claude Code, Codex, and future coding tools powered by OpenTelemetry.

## Requirements

- Grafana 12.3.0 or later
- A Prometheus-compatible data source (Grafana Cloud includes this by default)
- Claude Code with telemetry enabled for Claude Code-specific panels
- Codex with telemetry enabled if you want to compare tool usage in the shared views

## Installation

Install the plugin through the Grafana UI:
https://grafana.com/docs/grafana/latest/administration/plugin-management/plugin-install/#install-a-plugin-through-the-grafana-ui

## Configuration

### Step 1: Get Grafana Cloud OTLP Credentials

1. Go to your [Grafana Cloud Portal](https://grafana.com/profile/org)
2. Select your stack and click **Configure** in the OpenTelemetry tile
3. Click **Generate API Token**
4. Copy the OTLP endpoint and token

### Step 2: Configure Claude Code Environment Variables

Add these to your shell profile (`~/.zshrc`, `~/.bashrc`, or `~/.bash_profile`):

```bash
# Enable Claude Code telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1

# Configure OpenTelemetry metrics exporter
export OTEL_METRICS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"

# Grafana Cloud OTLP endpoint
export OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway-prod-<region>.grafana.net/otlp"
export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <your-base64-encoded-token>"

# IMPORTANT: Use cumulative temporality for Grafana Cloud compatibility
export OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative

# Optional: Adjust export interval (in milliseconds, default: 60000)
export OTEL_METRIC_EXPORT_INTERVAL=60000
```

Replace `<region>` with your Grafana Cloud region and `<your-base64-encoded-token>` with your API token.

### Step 3: Restart Claude Code

```bash
# Reload your shell config
source ~/.zshrc  # or ~/.bashrc

# Start Claude Code - telemetry will now be enabled
claude
```

### Optional: Configure Codex Telemetry

Codex supports OTLP exporters over HTTP and gRPC. Use the Codex telemetry schema separately from Claude Code, and only expect Claude Code cost, lines of code, commit, and pull request panels to populate from Claude Code metrics unless you normalize or derive equivalent fields upstream.

```toml
# ~/.codex/config.toml
[otel]
environment = "dev"
metrics_exporter = "otlp-http" # or "otlp-grpc"
```

Configure the OTLP endpoint and headers in Codex's OTel exporter settings for your collector or Grafana Cloud endpoint.

## Features

- **Overview**: Total cost, tokens, sessions, and active users
- **Costs**: Cost breakdown by model, team member, and time
- **Tokens**: Token usage by type (input, output, cache)
- **Tools**: Tool acceptance rates and usage
- **Productivity**: Lines of code, commits, and active time
- **Environment**: OS, architecture, and Claude Code version distribution
- **Codex support**: Shared usage views for Codex telemetry where metric schemas overlap

## Team Members

Team members are automatically identified by their email address from the `user_email` label in the metrics.
Codex telemetry in the live schema checked here does not include `user_email` or `device`, so team-member and device filters apply to Claude Code panels unless those labels are normalized upstream for Codex.

## Documentation

For Claude Code telemetry, see the [Claude Code Monitoring Usage Guide](https://docs.anthropic.com/en/docs/claude-code/monitoring-usage).
