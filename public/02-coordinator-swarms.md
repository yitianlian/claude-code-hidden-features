> **Disclaimer**
> All analysis is based on a specific version of the Claude Code source at [instructkr/claude-code](https://github.com/instructkr/claude-code). Claude Code is **not** open-source — all intellectual property belongs to **Anthropic**. This is independent source code analysis only.


The most sophisticated hidden feature in Claude Code is not a single capability — it is an entire multi-agent orchestration system. Three distinct but related systems allow Claude Code to split work across multiple agents that communicate, share memory, and coordinate through a central leader.

All three are gated. None ship in public builds.

---

## 1. Coordinator Mode

> **Feature Gate**
> Gated by: `feature('COORDINATOR_MODE')` + `CLAUDE_CODE_COORDINATOR_MODE=1`


Coordinator Mode transforms Claude Code from a single-agent tool into a **multi-worker orchestration system**. A coordinator agent manages the high-level plan while worker agents execute individual tasks in parallel.

### The Core Rule

The coordinator **never executes tasks itself**. It only delegates and synthesizes. From the system prompt embedded in `coordinatorMode.ts` (~370 lines):

```
You are a coordinator agent. You MUST NOT use tools directly to accomplish tasks.
Instead, you delegate ALL work to worker agents using the AgentTool.
Your role is to:
1. Understand the request
2. Break it into independent subtasks
3. Dispatch workers in parallel where possible
4. Synthesize results into a coherent response
```

### Communication Protocol

Workers report back to the coordinator through structured XML blocks:

```xml
<task-notification>
  <task-id>worker-3-refactor-auth</task-id>
  <status>completed</status>
  <summary>Refactored auth module to use OAuth2 PKCE flow</summary>
  <result>
    Modified 4 files:
    - src/auth/provider.ts (new OAuth2 client)
    - src/auth/callback.ts (PKCE verifier)
    - src/auth/types.ts (new token types)
    - src/auth/index.ts (updated exports)
    All tests passing.
  </result>
  <usage>
    <input-tokens>45000</input-tokens>
    <output-tokens>12000</output-tokens>
  </usage>
</task-notification>
```

Each notification includes a unique `<task-id>`, execution `<status>`, a human-readable `<summary>`, the detailed `<result>`, and token `<usage>` for cost tracking.

### Workflow Phases

The coordinator follows a strict four-phase workflow:

**Phase 1: Research (Parallel)**
Workers are dispatched in parallel to gather information. The coordinator might spawn 3-5 workers simultaneously to read different parts of the codebase, search for patterns, or analyze dependencies.

```typescript
// Coordinator dispatches research workers in parallel
await Promise.all([
  spawnWorker('research-1', 'Read all files in src/auth/ and summarize the auth flow'),
  spawnWorker('research-2', 'Find all usages of AuthProvider across the codebase'),
  spawnWorker('research-3', 'Read the test files in tests/auth/ and list what is covered'),
])
```

**Phase 2: Synthesis (Coordinator Only)**
The coordinator processes all research results and creates an implementation plan. No workers are involved in this phase — the coordinator uses its full context to make architectural decisions.

**Phase 3: Implementation (Workers)**
Workers execute the plan. Each worker handles one independent subtask. The coordinator ensures tasks are truly independent to avoid merge conflicts.

**Phase 4: Verification (Separate Workers)**
Fresh workers — not the ones who wrote the code — verify the implementation. This prevents the "checking your own homework" problem.

### Tool Access

The coordinator and workers have different tool sets:

| Role | Available Tools |
|---|---|
| **Coordinator** | `AgentTool`, `TaskStopTool`, `SendMessageTool` |
| **Workers** | `Bash`, `Read`, `Edit`, `Write`, `Grep`, `Glob`, and all standard tools |

The coordinator cannot read files, run commands, or edit code. It can only talk to workers and manage the task lifecycle.

### Scratchpad Storage

> **Feature Gate**
> Gated by: `tengu_scratch` (GrowthBook runtime flag)


When scratchpad is enabled, all agents in a coordinator session share a durable storage directory. Workers can write intermediate results to the scratchpad, and other workers (or the coordinator) can read them:

```typescript
// Worker 1 writes research results
await writeToScratchpad('auth-analysis.md', analysisContent)

// Worker 2 reads them as context for implementation
const analysis = await readFromScratchpad('auth-analysis.md')
```

This enables complex multi-step workflows where later workers build on earlier workers' findings without the coordinator needing to relay all information through conversation context.

---

## 2. Fork Subagent

> **Feature Gate**
> Gated by: `feature('FORK_SUBAGENT')`


Fork Subagent is a lighter-weight alternative to Coordinator Mode, designed for single-parent, single-child delegation with **prompt cache optimization**.

### Cache Optimization

The key innovation is that the child agent shares the parent's prompt cache. The child's API request starts with a byte-identical prefix to the parent's conversation, which means the cached KV pairs from the parent's context are reused:

```typescript
// The child inherits the parent's full conversation history + system prompt
// This means the first ~90% of the child's prompt is already cached
const child = forkSubagent({
  parentConversation: currentConversation,
  directive: 'Refactor the auth module to use PKCE',
  inheritSystemPrompt: true,
})
```

This dramatically reduces latency and cost for the child agent's first response, since most of the input tokens are cache hits.

### Directive Mode

Rather than passing background context separately, the parent sends only a directive — what to do, not why or what the codebase looks like. The child already has full context from the inherited conversation:

```typescript
const result = await child.execute({
  directive: 'Refactor the auth module to use PKCE',
  // No need to explain the codebase - child already knows
})
```

### Permission Bubbling

When a child agent needs to perform a sensitive action (like running a shell command), it uses `bubble` permission mode, which surfaces the permission prompt to the parent's terminal:

```typescript
const child = forkSubagent({
  permissionMode: 'bubble', // Prompts appear in parent terminal
  // ...
})
```

This means the user does not need to monitor multiple terminals. All approval requests appear in the same place.

### Child Agent Rules

The system prompt enforces strict rules for forked children:

1. **Do not fork sub-agents** — no recursive forking allowed
2. **Do not converse** — complete the task and return, no back-and-forth
3. **Commit before reporting** — if you made changes, commit them before returning
4. **Report under 500 words** — concise results only
5. **Start with "Scope:"** — every report begins with a scope declaration

```
Scope: Refactored src/auth/ to use PKCE flow.

Changes:
- Replaced implicit grant with authorization code + PKCE
- Added code_verifier generation in auth/crypto.ts
- Updated callback handler to exchange code with verifier
- All 12 existing tests updated and passing
- Added 3 new tests for PKCE-specific flows

Commit: a1b2c3d "refactor: migrate auth to OAuth2 PKCE flow"
```

---

## 3. Agent Swarms

> **Ant-Only Feature**
> Gated by: `tengu_amber_flint` (GrowthBook runtime flag) + `--agent-teams` CLI flag. This feature requires both a runtime flag from Anthropic's servers AND a CLI flag that only exists in internal builds.


Agent Swarms is the most ambitious multi-agent system. While Coordinator Mode runs agents within a single process, Agent Swarms spawns **real, separate Claude Code instances** across terminal panes.

### Architecture: Leader-Teammate Model

```
┌─────────────────────────────────────────────────┐
│  Terminal                                        │
│  ┌──────────────┐  ┌──────────────┐             │
│  │   Leader      │  │  Teammate 1  │             │
│  │   (main)      │  │  (tmux pane) │             │
│  │              │  │              │             │
│  │  Orchestrates │  │  Executes    │             │
│  │  the plan     │  │  subtask A   │             │
│  ├──────────────┤  ├──────────────┤             │
│  │  Teammate 2  │  │  Teammate 3  │             │
│  │  (tmux pane) │  │  (tmux pane) │             │
│  │              │  │              │             │
│  │  Executes    │  │  Executes    │             │
│  │  subtask B   │  │  subtask C   │             │
│  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────┘
```

The leader runs in the main terminal session. Teammates are spawned as separate processes in new tmux or iTerm panes.

### Backends

Three backends control how teammate processes are spawned:

```typescript
type SwarmBackend = 'tmux' | 'iterm' | 'in-process'
```

| Backend | How It Works |
|---|---|
| **TmuxBackend** | Spawns teammates in new tmux panes via `tmux split-window` |
| **ITermBackend** | Uses iTerm2's AppleScript API to create new panes |
| **InProcessBackend** | Runs teammates as child processes (no visible panes, for CI/testing) |

### Permission Synchronization

The `leaderPermissionBridge` ensures that permission decisions made by the leader propagate to all teammates:

```typescript
// When the leader approves "allow Bash commands in src/"
// All teammates automatically inherit that permission
const bridge = createLeaderPermissionBridge({
  leader: leaderSession,
  teammates: [teammate1, teammate2, teammate3],
})

bridge.onPermissionGranted((permission) => {
  // Propagate to all teammates
  teammates.forEach(t => t.grantPermission(permission))
})
```

This prevents the user from being bombarded with identical permission prompts from every teammate. Approve once on the leader, and all teammates proceed.

### Team Memory Sync

The `src/services/teamMemorySync/` module provides shared context across all agents in a swarm:

```typescript
// Teammate 1 discovers something important
await teamMemory.write({
  key: 'auth-module-pattern',
  value: 'This codebase uses a custom DI container in src/di/',
  scope: 'team', // Visible to all teammates
})

// Teammate 2 reads it before starting work
const insights = await teamMemory.readAll({ scope: 'team' })
// Now teammate 2 knows about the DI container without re-discovering it
```

This prevents redundant work where multiple teammates independently figure out the same thing about the codebase.

### Configuration Propagation

When the leader spawns teammates, it forwards its full configuration:

```typescript
const teammateConfig = {
  model: leaderConfig.model,           // Same model
  permissionMode: leaderConfig.permissionMode, // Same permission level
  plugins: leaderConfig.plugins,       // Same MCP plugins
  settings: leaderConfig.settings,     // Same user settings
  // Plus swarm-specific overrides:
  CLAUDE_CODE_TEAMMATE_COMMAND: taskDirective,
  CLAUDE_CODE_AGENT_COLOR: assignedColor,
  CLAUDE_CODE_PLAN_MODE_REQUIRED: 'true',
}
```

> **Environment Variables**
> Key swarm environment variables:
> - `CLAUDE_CODE_TEAMMATE_COMMAND` — the task directive for this teammate
> - `CLAUDE_CODE_AGENT_COLOR` — visual identifier in terminal UI
> - `CLAUDE_CODE_PLAN_MODE_REQUIRED` — forces teammates to plan before executing


### Plan Mode Enforcement

Teammates run with `CLAUDE_CODE_PLAN_MODE_REQUIRED=true`, which means they must output a plan and receive approval before executing any tools. This gives the leader (and the user) a chance to review what each teammate intends to do before it starts making changes.

---

## How These Systems Relate

The three multi-agent systems form a hierarchy of complexity:

| System | Agents | Process Model | Best For |
|---|---|---|---|
| **Fork Subagent** | 1 parent + 1 child | In-process | Quick delegation with cache reuse |
| **Coordinator Mode** | 1 coordinator + N workers | In-process | Structured multi-phase workflows |
| **Agent Swarms** | 1 leader + N teammates | Multi-process (tmux/iTerm) | Large-scale parallel execution |

Fork Subagent is the lightest — one parent delegates one task to one child. Coordinator Mode is more structured — a dedicated coordinator manages multiple workers through defined phases. Agent Swarms is the heaviest — real separate processes with their own terminals, shared memory, and permission synchronization.

> **None of This Ships Publicly**
> All three systems are gated by build-time feature flags or runtime GrowthBook flags. The public Claude Code binary contains none of this code. These features exist only in Anthropic's internal builds, and even there, runtime flags can disable them remotely.


---

## What This Means

Anthropic has built — and is actively using internally — a sophisticated multi-agent orchestration system on top of Claude Code. The fact that it is this mature (with permission bridging, memory sync, multiple backends, and structured communication protocols) suggests it has been in internal use for some time.

Whether any of these features will eventually ship to external users is unknown. But the infrastructure is built, tested, and gated behind flip-of-a-switch feature flags. Turning them on is a configuration change, not a development effort.
