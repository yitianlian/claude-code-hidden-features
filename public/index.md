import { LinkCard, CardGrid } from '@astrojs/starlight/components';

> **Disclaimer**
> All analysis is based on a specific version of the Claude Code source at [instructkr/claude-code](https://github.com/instructkr/claude-code). Claude Code is **not** open-source — all intellectual property belongs to **Anthropic**. This is independent source code analysis only.


We analyzed a [leaked version of the Claude Code source](https://github.com/instructkr/claude-code) and read every line. What we found is a codebase with an elaborate multi-layer feature gating system that hides **24+ fully-implemented features** from public builds.

This is not speculation. Every claim on this site is backed by direct source code references.

## The Scale of What's Hidden

| Metric | Count |
|---|---|
| `process.env.USER_TYPE === 'ant'` checks | **291+** across 143+ files |
| Build-time `feature()` flags via `bun:bundle` | **89** compile-time gates |
| Runtime `tengu_*` GrowthBook flags | **500+** server-side feature flags |
| Major hidden feature systems | **24+** |

When Anthropic builds Claude Code for public release, the Bun bundler evaluates every `feature()` call and every `USER_TYPE` check. If the flag is `false`, **dead-code elimination strips the entire code path**. The features literally do not exist in the binary you download.

## How It Works in Three Sentences

1. **Build time**: `process.env.USER_TYPE` is set to `'ant'` only for internal builds. The bundler inlines the value and eliminates unreachable branches.
2. **Compile time**: `feature('SOME_FLAG')` from `bun:bundle` returns `true` or `false` at bundle time. False branches are removed entirely.
3. **Runtime**: Even if code survives bundling, GrowthBook feature flags (`tengu_*`) gate functionality server-side, returning `false` for non-Anthropic accounts.

## The Hidden Features

Here is a summary of the major hidden features we have identified so far:

| Feature | Gate | Description |
|---|---|---|
| Coordinator Mode | `feature('COORDINATOR_MODE')` | Multi-agent orchestration where a coordinator delegates to parallel workers |
| Fork Subagent | `feature('FORK_SUBAGENT')` | Cache-optimized child agents that inherit parent conversation history |
| Agent Swarms | `tengu_amber_flint` | Leader-teammate model with tmux/iTerm pane spawning and shared memory |
| Kairos | `feature('KAIROS')` | Scheduled background agent execution with cron-like triggers |
| Auto Dream | `tengu_onyx_plover` | Automated memory consolidation and context summarization |
| Scratchpad | `tengu_scratch` | Cross-worker durable storage directory for multi-agent workflows |
| Hearth | `feature('HEARTH')` | Persistent background services and daemon management |
| MCP Auth | `feature('MCP_AUTH')` | OAuth-based authentication for MCP server connections |
| Notebook Support | `feature('NOTEBOOK')` | Native Jupyter notebook editing and execution |
| GitHub PR Integration | `feature('GITHUB_PR')` | Deep pull request review and management workflows |
| Interop Mode | `feature('INTEROP')` | Cross-tool integration protocol for editor extensions |
| Prompt Caching | `ant`-gated | Advanced prompt cache management and optimization |
| Custom Models | `ant`-gated | Internal model selection beyond public offerings |
| MDM Policies | `ant`-gated | Mobile Device Management policy enforcement |
| Telemetry Dashboard | `ant`-gated | Internal usage analytics and performance monitoring |
| Subscription Tiers | `ant`-gated | Feature differentiation across max/pro/plus/basic tiers |
| Permission Bridge | `ant`-gated | Cross-agent permission synchronization |
| Team Memory Sync | `ant`-gated | Shared context propagation across agent teams |
| Monorepo Detection | `MONOREPO_ROOT_DIR` | Special features when running inside Anthropic's monorepo |
| Plugin System | `ant`-gated | Extended plugin architecture beyond public MCP |
| Background Tasks | `ant`-gated | Long-running task management with progress tracking |
| Session Handoff | `ant`-gated | Transfer active sessions between devices/instances |
| Smart Retry | `ant`-gated | Intelligent request retry with backoff strategies |
| Config Sync | `ant`-gated | Cross-device configuration synchronization |

## Deep Dives

<CardGrid>
  <LinkCard
    title="How Anthropic Hides Features in Plain Sight"
    description="The three-layer gating system: build-time elimination, runtime flags, and auth gates."
    href="/claude-code-hidden-features/01-how-features-are-hidden/"
  />
  <LinkCard
    title="Coordinator Mode: The Hidden Multi-Agent Orchestra"
    description="Multi-worker orchestration, fork subagents, and agent swarms with shared memory."
    href="/claude-code-hidden-features/02-coordinator-swarms/"
  />
</CardGrid>

---

> **Disclaimer**
> All analysis on this site is based on a [specific version of the Claude Code source](https://github.com/instructkr/claude-code). Claude Code itself is **not** open-source — this repository represents a particular version's source code. All intellectual property and credit belong to **Anthropic**. We have no insider access, no affiliation with Anthropic. Features described here may change, be removed, or differ from our analysis. This is source code archaeology, not official documentation.

