# Claude Code Hidden Features

**Analyzing the secret features that only Anthropic employees can use — based on source code analysis of [instructkr/claude-code](https://github.com/instructkr/claude-code).**

> We analyzed a [specific version of the Claude Code source](https://github.com/instructkr/claude-code) and found **24+ hidden features**, **89 build-time feature flags**, and **500+ runtime gates** that are invisible to regular users -- stripped from public builds via dead-code elimination.
>
> **Note:** Claude Code is NOT open-source. This analysis is based on a particular version's source code. All IP and credit belong to Anthropic.

---

## What We Found

The public Claude Code CLI you download is **not** the same tool Anthropic employees use internally. Through source code archaeology, we discovered a parallel universe of capabilities hidden behind `process.env.USER_TYPE === 'ant'` (291+ locations across the codebase):

| Hidden Feature | What It Does |
|---|---|
| **Coordinator Mode** | Multi-agent orchestration -- a "director" agent that delegates to parallel worker agents |
| **Agent Swarms** | Spawn teams of Claude agents in tmux/iTerm panes, with shared memory and permission sync |
| **Fork Subagent** | Cache-optimized child agents that inherit full conversation context |
| **KAIROS System** | Background async tasks, GitHub webhooks, push notifications, channel subscriptions |
| **Proactive Mode** | Autonomous task execution without user input |
| **Auto Dream** | Background memory consolidation -- a forked agent reviews your past sessions every 24h |
| **Scheduled Agents** | Run Claude agents on cron schedules (up to 50 concurrent, 7-day expiry) |
| **Voice Mode** | Real-time voice-to-text with push-to-talk |
| **Web Browser Tool** | Built-in browser automation via Chrome DevTools |
| **SSH Remote** | Execute on remote machines via SSH |
| **Cloud Execution (CCR)** | UltraPlan, UltraReview, autofix-pr in cloud environments |
| **AI Buddy System** | Backseat observer + skill coach modes |
| **Auto Permission Mode** | Transcript classifier that auto-approves safe tool uses |
| **Undercover Mode** | Strips internal codenames and Slack channels from commits in public repos |
| **IDE Bridge** | Multi-session management (up to 32 concurrent) with worktree isolation |

## How It Works

Anthropic uses a **three-layer gating system** to hide features:

```
Layer 1: Build-time    process.env.USER_TYPE === 'ant'     (291+ checks)
         Dead code     feature() from bun:bundle            (89 flags)
         elimination   Code is literally removed from public builds

Layer 2: Runtime       GrowthBook feature flags             (500+ tengu_* flags)
         Server-side   Evaluated per-user, per-session

Layer 3: Auth          Anthropic OAuth + subscription tier
         Context       MDM policies, environment detection
```

## Read the Full Analysis

| # | Article | Description |
|---|---------|-------------|
| 0 | [Overview](src/content/docs/index.mdx) | What we found and why it matters |
| 1 | [How Features Are Hidden](src/content/docs/01-how-features-are-hidden.mdx) | The three-layer gating system explained |
| 2 | [Coordinator & Agent Swarms](src/content/docs/02-coordinator-swarms.mdx) | Multi-agent orchestration deep dive |
| 3 | [KAIROS, Dream & Cron](src/content/docs/03-kairos-dream-cron.mdx) | The autonomous agent system |
| 4 | [Voice, Browser & Remote](src/content/docs/04-voice-browser-remote.mdx) | Unreleased superpowers |
| 5 | [Auto Mode & Buddy](src/content/docs/05-auto-mode-buddy.mdx) | AI coaching and auto-permissions |
| 6 | [All Feature Flags](src/content/docs/06-all-feature-flags.mdx) | Complete list of 89 build flags + runtime gates |
| 7 | [How to Enable](src/content/docs/07-how-to-enable.mdx) | Speculative analysis (to be continued) |

## Disclaimer

All analysis is based on a specific version of the Claude Code source at [instructkr/claude-code](https://github.com/instructkr/claude-code). **Claude Code is NOT open-source — all intellectual property and credit belong to Anthropic.** This is independent source code analysis, not official documentation, and is not affiliated with or endorsed by Anthropic in any way. Hidden features may change or be removed at any time.

## License

MIT

---

**If you found this useful, please star the repo!**
