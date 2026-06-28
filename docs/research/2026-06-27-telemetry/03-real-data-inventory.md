# Real Data Inventory — Remote Prometheus at 162.55.221.167:9090 (2026-06-27)

> **Note:** The local Prometheus at localhost:9090 is empty — the OTEL collector has been running since 2026-06-24 but has received zero Claude Code telemetry. All real data lives on the Hetzner remote Prometheus below, which is the default "Claude Stats Remote" datasource in Grafana.

Queried: `http://162.55.221.167:9090` — confirmed live (head max time: 2026-06-27 21:35 UTC).
Data retention: 2026-03-28 through 2026-06-27 (~90 days).
Total metric names: 474. AI-telemetry metrics: 154 (8 claude_code_* + 146 codex_*).

---

## 1. Metric Inventory

### claude_code_* (8 metrics — all documented, all present)

| Metric | Series count | Key labels beyond base set | Notes |
|--------|-------------|--------------------------|-------|
| `claude_code_session_count_total` | 5,197 | `start_type`, `claude_deployment_mode`, `host_arch`, `os_version`, `wsl_version` | No model/cost labels |
| `claude_code_cost_usage_USD_total` | 8,597 | `model`, `query_source`, `effort`, `agent_name`, `skill_name`, `plugin_name`, `marketplace_name`, `mcp_server_name`, `mcp_tool_name` | Richest label set |
| `claude_code_token_usage_tokens_total` | 34,388 | same as cost + `type` (input/output/cacheRead/cacheCreation) | Highest cardinality |
| `claude_code_lines_of_code_count_total` | 3,206 | `model`, `type` (added/removed) | model IS present on this metric |
| `claude_code_commit_count_total` | 766 | base set only | No model label |
| `claude_code_pull_request_count_total` | 401 | base set only (no wsl_version) | No model label |
| `claude_code_active_time_seconds_total` | 3,803 | `type` (cli/user) | No model label |
| `claude_code_code_edit_tool_decision_total` | 4,901 | `decision`, `language`, `source`, `tool_name` | Full documented set |

**Base label set** (present on virtually all claude_code_* metrics):
`claude_deployment_mode`, `device`, `host_arch`, `job`, `organization_id`, `os_type`, `os_version`, `otel_scope_name`, `otel_scope_version`, `service_name`, `service_version`, `session_id`, `terminal_type`, `user_account_id`, `user_account_uuid`, `user_email`, `user_id`

### codex_* (146 metric names — ~28 logical families, entirely undocumented)

| Family | Key metrics | Series | Notable labels | What it measures |
|--------|-------------|--------|---------------|-----------------|
| `codex_goal_*` | goal_created, completed, resumed, usage_limited, duration_s (hist), token_count (hist) | 2–4 | `env`, `os`, `os_version` | Goal lifecycle: create→complete with duration and token cost |
| `codex_guardian_review_*` | review_total, duration_ms (hist), token_usage (hist), ttft_duration_ms (hist) | 20 | `action`, `approval_request_source`, `decision`, `guardian_model`, `guardian_reasoning_effort`, `had_prior_review_context`, `outcome`, `reviewed_action_truncated`, `risk_level`, `session_kind`, `terminal_status`, `user_authorization` | Safety/guardian review; rich risk/outcome metadata |
| `codex_memory_phase1_*` | phase1_total, e2e_ms (hist), output_total, token_usage (hist) | 36 | `model`, `originator`, `session_source`, `status` | First phase of two-phase memory consolidation |
| `codex_memory_phase2_*` | phase2_total, e2e_ms (hist), input_total, token_usage (hist) | 50 | same as phase1 | Second phase of memory consolidation |
| `codex_multi_agent_spawn_*` | spawn_total | 3 | `model`, `role` (explorer/worker/etc.), `version` | Multi-agent thread spawning |
| `codex_hooks_run_*` | hooks_run_total, duration_ms (hist) | 67 | `hook_name` (PostToolUse/PreToolUse/SessionStart/Stop/UserPromptSubmit), `source`, `status` | Hook execution by type and outcome |
| `codex_mcp_call_*` | mcp_call_total, duration_ms (hist) | 22 | `connector_id`, `connector_name`, `tool`, `status` | MCP tool call outcomes and timing |
| `codex_mcp_tools_*` | cache_write_duration_ms, fetch_uncached_duration_ms, list_duration_ms (hist) | — | — | MCP tool list caching performance |
| `codex_thread_*` | thread_started, skills_description_truncated_chars (hist), skills_enabled_total (hist), skills_kept_total (hist), skills_truncated (hist) | 42 | `is_git`, `model` | Thread lifecycle and skill context window management |
| `codex_turn_*` | turn_e2e_duration_ms (hist), turn_ttft_duration_ms (hist), turn_ttfm_duration_ms (hist), turn_token_usage (hist), turn_tool_call (hist), turn_memory_total, turn_network_proxy_total | 31 | `model`, `session_source` | Per-turn latency (TTFT, TTFM, e2e), token usage, tool calls |
| `codex_api_request_*` | api_request_total, api_request_duration_ms (hist) | 54 | `model`, `status` (HTTP code), `success` | Raw API call outcomes and latency |
| `codex_tool_call_*` | tool_call_total, duration_ms (hist) | 151 | `tool`, `sandbox`, `sandbox_policy`, `success` | Tool execution with sandbox context |
| `codex_skill_injected_*` | skill_injected_total | 3 | `invoke_type` (implicit/explicit), `skill`, `status` | Skill injection into context |
| `codex_feature_state_*` | feature_state_total | 240 | `feature`, `value` | Feature flag state per session (memories, multi_agent, apps, hooks, plugins, etc.) |
| `codex_startup_*` | startup_phase_duration_ms (hist), startup_prewarm_duration_ms (hist), startup_prewarm_age_at_first_turn_ms (hist) | 109 | `phase`, `status` | Startup and prewarm lifecycle timing |
| `codex_plugins_*` | plugins_startup_sync_total, plugins_startup_sync_final_total | 13 | `status`, `transport` | Plugin sync on startup |
| `codex_external_agent_config_*` | external_agent_config_detect_total, external_agent_config_import_total | 24 | `migration_type`, `skills_count` | External agent config detection and import |
| `codex_websocket_*` | websocket_event_total, event_duration_ms (hist), request_total, request_duration_ms (hist) | 15 | `kind`, `success` | WebSocket transport events |
| `codex_sse_event_*` | sse_event_total, sse_event_duration_ms (hist) | 344 | `kind`, `success` | SSE streaming events |
| `codex_shell_snapshot_*` | shell_snapshot_total, shell_snapshot_duration_ms (hist) | 30 | `success` | Shell state snapshot operations |
| `codex_memories_usage_*` | memories_usage_total | 10 | `kind`, `success`, `tool` | Memory store access patterns |
| `codex_sqlite_*` | sqlite_init_count, sqlite_fallback_count, sqlite_init_duration_ms (hist) | — | `status` | SQLite DB initialization |
| `codex_db_backfill_*` | db_backfill_total, db_backfill_duration_ms (hist) | 2 | `status` | DB migration/backfill operations |
| `codex_remote_models_*` | remote_models_fetch_update_duration_ms (hist), remote_models_load_cache_duration_ms (hist) | — | — | Remote model list fetching and caching |
| `codex_task_*` | task_compact_total, task_user_shell_total | — | — | Task compaction and user shell operations |
| `codex_conversation_turn_count_total` | single counter | — | — | Total conversation turn count |
| `codex_process_start_total` | 13 | `originator` | Process startup events by client type |
| `codex_rollout_compression_*` | rollout_compression_materialize_total | — | — | Compression feature rollout tracking |

---

## 2. New Claude Code Labels: Present vs Absent

| Label | Present? | Distinct values / Notes |
|-------|---------|------------------------|
| `start_type` | **PRESENT** | `fresh`, `resume` — on session_count only |
| `query_source` | **PRESENT** | `auxiliary`, `main`, `subagent` — on cost and token metrics |
| `effort` | **PRESENT** | `high`, `max`, `medium`, `xhigh` — on cost and token metrics |
| `agent_name` | **PRESENT** | 15 values: Explore, Plan, caveman:cavecrew-builder, caveman:cavecrew-reviewer, claude, claude-code-guide, codex:codex-rescue, custom, deep-researcher, dev-worker, feature-dev:code-explorer, feature-dev:code-reviewer, general-purpose, researcher, workflow-subagent |
| `skill_name` | **PRESENT** | 55 values including all superpowers:* skills, code-review, deep-research, commit-guard, etc. |
| `plugin_name` | **PRESENT** | `claude-md-management`, `feature-dev`, `superpowers`, `third-party` |
| `mcp_server_name` | PRESENT but opaque | Only 1 value: `custom` — no granular server names populated |
| `mcp_tool_name` | PRESENT but opaque | Only 1 value: `custom` — no granular tool names populated |
| `speed` | **ABSENT** | 0 distinct values in entire dataset |
| `model` on `lines_of_code` | **PRESENT** | Confirmed: e.g. model=claude-opus-4-8 on lines_of_code series |

### Additional undocumented labels present in real data

| Label | Values | Notes |
|-------|--------|-------|
| `claude_deployment_mode` | `1p` | Deployment mode flag, not in AGENTS.md |
| `host_arch` | `amd64`, `arm64` | Machine architecture separate from os_type |
| `organization_id` | 1 UUID | Organization/team scoping |
| `user_account_id` | per-user | Opaque account identifier (different from user_account_uuid) |
| `user_id` | per-user (hashed) | SHA-256 hashed user identifier |
| `os_version` | 103 values | Full OS version string |
| `wsl_version` | `2` | WSL version for Windows users |
| `service_version` | 103 versions | Claude Code version string (2.1.x range + codex 0.x range) |
| `marketplace_name` | `claude-plugins-official` | Plugin marketplace identifier |
| `otel_scope_name` | `com.anthropic.claude_code` | OTLP instrumentation scope |

---

## 3. Label Distinct Values

| Label | Count | Values |
|-------|-------|--------|
| `terminal_type` | 11 | WarpTerminal, WezTerm, androidstudio, dumb, ghostty, non-interactive, tmux, vscode, windows-terminal, wsl-Ubuntu, xterm-256color |
| `os_type` | 3 | darwin, linux, windows |
| `decision` | 4 | accept, **approved**, **denied**, reject (`approved`/`denied` come from codex guardian, different vocabulary) |
| `source` | 8 | config, hook, **plugin**, project, user, user_permanent, user_reject, user_temporary (`plugin` is undocumented) |
| `language` | 20 | Bash, Batch file (DOS), C#, C++, CSS, Go, HTML XML, JSON, Javascript, Kotlin, Markdown, Plain text, Python, Rust, SQL, Swift, TOML/INI, TypeScript, YAML, unknown |
| `model` | 27 | All claude-* variants (fable-5, opus-4-8, sonnet-4-6, haiku-4-5 with [1m] suffixes, plus older aliases) + **gpt-5.4, gpt-5.4-mini, gpt-5.5, glm-4.5-air, glm-4.7, glm-5-turbo, glm-5.1[1m], glm-5.2[1m], codex-auto-review** |
| `user_email` | **7** distinct users | Cardinality only; values not shown |
| `session_id` | **6,199** | Distinct session UUIDs |
| `type` | 12 | added, cacheCreation, cacheRead, cli, float, histogram, input, local, output, remote_v2, removed, user |
| `start_type` | 2 | fresh, resume |
| `query_source` | 3 | auxiliary, main, subagent |
| `effort` | 4 | high, max, medium, xhigh |
| `host_arch` | 2 | amd64, arm64 |

### Codex-specific label values

| Label | Count | Values |
|-------|-------|--------|
| `token_type` | 6 | cached_input, input, non_cached_input, output, reasoning_output, total |
| `originator` | 5 | Codex_Desktop, codex-app-server, codex-tui, codex_cli_rs, codex_exec |
| `session_source` | 7 | cli, exec, internal_memory_consolidation, subagent_guardian, subagent_thread_spawn_* (dynamic UUIDs), vscode |
| `os` (codex) | 1 | Mac_OS |
| `tool` (codex) | 30 | exec_command, apply_patch, multi_agent_v1spawn_agent, multi_agent_v1close_agent, mcp__serena*, mcp__codex_apps__*, js, write_stdin, view_image, request_user_input, tool_search, create_goal/update_goal/get_goal/update_plan, etc. |
| `success` | 2 | false, true |
| `hook_name` | 5 | PostToolUse, PreToolUse, SessionStart, Stop, UserPromptSubmit |
| `feature` | 15 | apps, auth_elicitation, enable_mcp_apps, external_migration, hooks, memories, multi_agent, network_proxy, plugins, prevent_idle_sleep, remote_compaction_v2, remote_plugin, resize_all_images, skill_mcp_dependency_install, apply_patch_streaming_events |

---

## 4. Coverage Gaps

### Documented metrics ABSENT from real data
None — all 8 documented `claude_code_*` metrics are present and populated.

### Documented labels ABSENT from real data
- `speed` — 0 values; not populated by any client version in this 90-day dataset
- `device` — listed in AGENTS.md as custom via OTEL_RESOURCE_ATTRIBUTES; 0 users configured it

### Real-but-undocumented

- **Non-Anthropic models**: gpt-5.4/5.5, glm-4.5-air/4.7/5.x, codex-auto-review appear in cost and token metrics — the dashboard currently has no awareness of multi-provider usage
- **`codex_*` family (146 metrics)**: entirely absent from AGENTS.md
- **`source=plugin`** on code_edit_tool_decision — undocumented source value
- **`decision=approved`/`denied`**: from codex guardian reviews, clashes with claude_code accept/reject vocabulary
- **`marketplace_name`**, **`claude_deployment_mode`**, **`host_arch`**, **`organization_id`**, **`user_account_id`**, **`user_id`** — none in AGENTS.md
- **`mcp_server_name`/`mcp_tool_name`** both collapsed to `custom` — label exists but granular values never populated

---

## 5. Sample Query Outputs (sanity checks)

```
# Data freshness
head_max_time:        2026-06-27 21:35:01 UTC  (live and current)
lowest_timestamp:     2026-03-28 10:57:31 UTC  (~90 days retention)

# Claude Code totals (last_over_time[90d] required — most series are stale session-scoped counters)
Sessions:             5,148 distinct series
Total cost USD:       $8,399.70
Tokens (head window): 697,558  (historical total much larger)
Lines of code added:  553,202
Commits:              1,448
PRs:                  436

# Codex totals
Codex API requests:   873
Codex tool calls:     1,422
Guardian reviews:     54
Conversation turns:   43
Multi-agent spawns:   1
Goals created:        2
```

> **Query note:** Plain `sum(claude_code_session_count_total)` returns near-zero because series are stale (session-scoped counters stop updating when the session ends). Use `sum(last_over_time(metric[90d]))` for correct totals across this dataset.

---

## Summary

154 AI-telemetry metric families confirmed in the remote Prometheus. All 8 documented `claude_code_*` metrics are present with 90 days of real data covering 7 users, ~5,148 sessions, $8,399.70 in total cost, 553K LOC added, and 1,448 commits. The dataset spans darwin/linux/windows with 11 distinct terminal types and 103 distinct Claude Code versions.

**New Claude Code labels — real vs absent:**
`start_type`, `query_source`, `effort`, `agent_name` (15 values), `skill_name` (55 values), `plugin_name` (4 values) are all PRESENT. `mcp_server_name`/`mcp_tool_name` exist but are collapsed to `custom`. `speed` is ABSENT. `model` is confirmed on `lines_of_code`.

**Biggest surprises:**
1. **27 model values including non-Anthropic providers** — gpt-5.4/5.5, glm-4.5-air through glm-5.2, codex-auto-review appear in cost/token metrics; the dashboard only expects Claude model IDs.
2. **`codex_guardian_review_*`** is the richest undocumented metric family: full risk scoring pipeline (risk_level, outcome, user_authorization, had_prior_review_context, reviewed_action_truncated) enabling a complete AI safety audit trail — nothing in AGENTS.md hints at this.
3. **`codex_feature_state_total`** exposes 15 feature flags per session (memories, multi_agent, apps, hooks, plugins, etc.) enabling feature adoption cohort analysis.
4. **`mcp_server_name`/`mcp_tool_name` are always "custom"** — the fine-grained MCP attribution labels exist in the schema but carry no useful signal in real data.
