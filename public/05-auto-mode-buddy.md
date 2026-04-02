import { Aside, Badge, Card, CardGrid, Tabs, TabItem } from '@astrojs/starlight/components';

> **Disclaimer**
> All analysis is based on a specific version of the Claude Code source at [instructkr/claude-code](https://github.com/instructkr/claude-code). Claude Code is **not** open-source — all intellectual property belongs to **Anthropic**. This is independent source code analysis only.


In this article we explore some of Claude Code's most interesting hidden subsystems: automatic permission handling, an AI coaching companion called "Buddy," extended thinking modes, a verification agent, and away-mode summaries. All of these are gated behind build-time feature flags and runtime checks, meaning they are not available in the public build.

## Auto Permission Mode

<Badge text="Gated by feature('TRANSCRIPT_CLASSIFIER')" variant="caution" />

Claude Code ships with several **permission modes** that control how tool-use requests (file edits, shell commands, etc.) are approved:

| Mode | Available | Behavior |
|------|-----------|----------|
| `default` | Public | Prompts the user for every potentially dangerous action |
| `plan` | Public | Only allows read-only tools; no writes or executions |
| `dontAsk` | Public | Allows all edits without asking, but still prompts for shell commands |
| `acceptEdits` | Public | Accepts file edits automatically, prompts for shell |
| `bypassPermissions` | Public | Skips all permission checks (the classic "YOLO mode") |
| `auto` | Ant-only | Uses a transcript classifier to decide automatically |
| `bubble` | Ant-only | Permissions bubble up to the parent process |

### How `auto` Mode Works

The `auto` permission mode is fundamentally different from `bypassPermissions`. Instead of blindly accepting everything, it feeds the current conversation transcript into a **classifier model** that decides whether each tool use is safe.

For complex or ambiguous decisions, the classifier employs a **two-stage XML thinking** approach: it first reasons about the safety implications in a structured XML format before producing a final allow/deny decision.

Configuration is managed through the `tengu_auto_mode_config` GrowthBook flag, which accepts three values:

- **`enabled`** -- Auto mode is available and on by default
- **`opt-in`** -- Auto mode is available but must be explicitly selected
- **`disabled`** -- Auto mode is hidden entirely

### YOLO Classifier

Separately, there exists a `yoloClassifier.ts` module that takes a different approach: instead of classifying the full transcript, it specifically analyzes **bash commands** to determine whether they are safe to auto-approve. Think of it as a smarter version of `bypassPermissions` that only applies to shell commands it deems non-destructive.

## Bubble Permission Mode

<Badge text="Ant-only" variant="danger" />

The `bubble` permission mode is designed specifically for **fork subagents** (child agents spawned by the coordinator). When a child agent encounters a permission prompt, instead of handling it locally, the prompt **bubbles up** to the parent terminal session.

This means the parent agent (or the human operator watching the parent) makes all permission decisions, while child agents focus purely on execution. It is a clean separation of concerns in a multi-agent orchestration setup.

## Buddy System

<Badge text="Gated by feature('BUDDY')" variant="caution" />

One of the more unexpected discoveries in the codebase is a full **AI coaching companion** system located in `src/buddy/`.

### Key Files

- `companion.ts` -- Core companion logic
- `CompanionSprite.tsx` -- Visual sprite rendering (yes, it has a visual avatar)
- `sprites.ts` -- Sprite definitions and animations
- `useBuddyNotification.tsx` -- Notification integration hooks

### Observer Modes

The Buddy can operate in two modes:

<Tabs>
  <TabItem label="Backseat Mode">
    In `backseat` mode, the Buddy watches your coding session and provides coaching comments. It observes what you are doing and offers suggestions, warnings, or encouragement without directly intervening. Think of it as a pair programmer who watches over your shoulder.
  </TabItem>
  <TabItem label="Skill Coach Mode">
    In `skillcoach` mode, the Buddy actively teaches you skills. Rather than passively observing, it guides you through techniques and best practices, acting more like a tutor than a spectator.
  </TabItem>
</Tabs>

You can also configure it as `both` to combine the two modes.

GrowthBook cohort events are tracked under the `tengu_backseat_*` namespace, suggesting this feature has been through (or is currently in) A/B testing among Anthropic employees.

## UltraThink and UltraPlan

<CardGrid>
  <Card title="UltraThink" icon="rocket">
    Gated by `feature('ULTRATHINK')`. Enables **extended thinking** -- deeper, longer reasoning chains that go beyond the standard thinking budget. When activated, the model spends significantly more compute on complex problems before responding.
  </Card>
  <Card title="UltraPlan" icon="list-format">
    Gated by `feature('ULTRAPLAN')`. A **remote multi-phase detailed planning** system. Rather than generating a plan in a single pass, UltraPlan breaks planning into phases with a state machine: `needs_input` transitions to `plan_ready` once sufficient context has been gathered.
  </Card>
</CardGrid>

These features represent Anthropic's experiments with giving the model more time and structure to think through difficult problems, rather than rushing to an answer.

## Verification Agent

<Badge text="Gated by feature('VERIFICATION_AGENT') + tengu_hive_evidence" variant="caution" />

The Verification Agent is a built-in agent that **automatically verifies code changes** after they are made. The key design principle is that it runs with "fresh eyes" -- it operates in a context separate from the implementation workers, so it is not biased by the reasoning that led to the changes.

This is particularly powerful in coordinator mode, where implementation is delegated to worker subagents. The verification agent can review the workers' output independently, catching errors that the implementer might have been blind to.

## Away Summary

<Badge text="Gated by feature('AWAY_SUMMARY') + tengu_sedge_lantern" variant="caution" />

The Away Summary feature detects when the user is **away from keyboard** and generates summaries of what happened while they were gone. When active, an `AFK_MODE_BETA_HEADER` is sent to the API to signal that the user is not actively watching.

This is useful in long-running sessions -- for example, if you kick off a large refactoring task and come back 30 minutes later, the away summary gives you a concise recap of what was accomplished, what failed, and what decisions were made in your absence.

---

<Aside type="note">
All of these features are gated behind Anthropic-internal build flags and GrowthBook runtime checks. They cannot be enabled in the public build of Claude Code without rebuilding from source and modifying the feature gate configuration.
</Aside>
