import { Aside, Badge, Card, CardGrid, Tabs, TabItem } from '@astrojs/starlight/components';

> **免责声明**
> 本文所有分析均基于某个版本的 Claude Code 源码 [instructkr/claude-code](https://github.com/instructkr/claude-code)。Claude Code **并非**开源项目，所有知识产权归 **Anthropic** 所有。本文仅为独立的源代码分析。


本文将探索 Claude Code 中一些最有趣的隐藏子系统：自动权限处理、名为 "Buddy" 的 AI 辅导伙伴、扩展思考模式、验证代理 (Verification Agent) 以及离开模式摘要。所有这些功能都受构建时特性标志 (Feature Flags) 和运行时检查的门控，意味着它们在公开版本中不可用。

## 自动权限模式 (Auto Permission Mode)

<Badge text="Gated by feature('TRANSCRIPT_CLASSIFIER')" variant="caution" />

Claude Code 内置了多种**权限模式**，用于控制工具使用请求（文件编辑、Shell 命令等）的审批方式：

| 模式 | 可用性 | 行为 |
|------|--------|------|
| `default` | 公开 | 每次潜在危险操作都会提示用户确认 |
| `plan` | 公开 | 仅允许只读工具，不允许写入或执行 |
| `dontAsk` | 公开 | 允许所有编辑而不询问，但 Shell 命令仍需确认 |
| `acceptEdits` | 公开 | 自动接受文件编辑，Shell 命令仍需确认 |
| `bypassPermissions` | 公开 | 跳过所有权限检查（经典的 "YOLO 模式"） |
| `auto` | 仅限 Ant | 使用转录分类器自动决策 |
| `bubble` | 仅限 Ant | 权限向上冒泡到父进程 |

### `auto` 模式的工作原理

`auto` 权限模式与 `bypassPermissions` 有本质区别。它不是盲目接受所有请求，而是将当前对话转录 (transcript) 输入到一个**分类器模型**中，由模型决定每次工具使用是否安全。

对于复杂或模糊的决策，分类器采用**两阶段 XML 推理**方法：首先以结构化 XML 格式分析安全影响，然后给出最终的允许/拒绝决定。

配置通过 `tengu_auto_mode_config` GrowthBook 标志管理，接受三个值：

- **`enabled`** -- 自动模式可用且默认开启
- **`opt-in`** -- 自动模式可用但需要手动选择
- **`disabled`** -- 自动模式完全隐藏

### YOLO 分类器

另外还存在一个 `yoloClassifier.ts` 模块，它采用不同的方法：不是对整个转录进行分类，而是专门分析 **Bash 命令**来判断是否可以安全地自动批准。可以把它理解为 `bypassPermissions` 的智能版本，仅对它认为非破坏性的 Shell 命令生效。

## Bubble 权限模式

<Badge text="Ant-only" variant="danger" />

`bubble` 权限模式专为 **Fork 子代理** (fork subagents，由协调器生成的子代理) 设计。当子代理遇到权限提示时，不是在本地处理，而是将提示**向上冒泡**到父终端会话。

这意味着父代理（或监视父进程的人类操作者）做出所有权限决策，而子代理专注于执行。这是多代理编排架构中一种清晰的职责分离。

## Buddy 系统

<Badge text="Gated by feature('BUDDY')" variant="caution" />

代码库中一个出人意料的发现是位于 `src/buddy/` 的完整 **AI 辅导伙伴**系统。

### 关键文件

- `companion.ts` -- 伙伴核心逻辑
- `CompanionSprite.tsx` -- 可视化精灵渲染（没错，它有一个视觉形象）
- `sprites.ts` -- 精灵定义和动画
- `useBuddyNotification.tsx` -- 通知集成 hooks

### 观察者模式

Buddy 可以在两种模式下运行：

<Tabs>
  <TabItem label="旁观模式 (Backseat)">
    在 `backseat` 模式下，Buddy 会观察你的编码会话并提供辅导评论。它观察你的操作，提出建议、警告或鼓励，而不直接干预。可以把它想象成一个在你身后看着你写代码的结对编程伙伴。
  </TabItem>
  <TabItem label="技能教练模式 (Skill Coach)">
    在 `skillcoach` 模式下，Buddy 会主动教授你技能。它不是被动观察，而是引导你学习技巧和最佳实践，更像是一个导师而非旁观者。
  </TabItem>
</Tabs>

你也可以将其配置为 `both` 以同时启用两种模式。

GrowthBook 群组事件在 `tengu_backseat_*` 命名空间下被跟踪，这表明该功能已经（或正在）在 Anthropic 员工中进行 A/B 测试。

## UltraThink 和 UltraPlan

<CardGrid>
  <Card title="UltraThink" icon="rocket">
    由 `feature('ULTRATHINK')` 门控。启用**扩展思考** -- 超越标准思考预算的更深层、更长链的推理。激活后，模型会在回复前花费显著更多的计算资源来处理复杂问题。
  </Card>
  <Card title="UltraPlan" icon="list-format">
    由 `feature('ULTRAPLAN')` 门控。一个**远程多阶段详细规划**系统。UltraPlan 不是一次性生成计划，而是通过状态机将规划分解为多个阶段：`needs_input` 在收集到足够上下文后转换为 `plan_ready`。
  </Card>
</CardGrid>

这些功能代表了 Anthropic 在给予模型更多时间和结构来思考困难问题方面的实验，而不是急于给出答案。

## 验证代理 (Verification Agent)

<Badge text="Gated by feature('VERIFICATION_AGENT') + tengu_hive_evidence" variant="caution" />

验证代理是一个内置代理，在代码变更完成后**自动验证这些变更**。其关键设计原则是以"全新视角"运行 -- 它在与实现工作者独立的上下文中运行，不会受到导致这些变更的推理过程的影响。

这在协调器模式下尤为强大，因为实现工作被委派给工作子代理。验证代理可以独立审查工作者的输出，捕获实现者可能忽略的错误。

## 离开摘要 (Away Summary)

<Badge text="Gated by feature('AWAY_SUMMARY') + tengu_sedge_lantern" variant="caution" />

离开摘要功能会检测用户是否**离开键盘**，并生成用户不在时发生事件的摘要。激活时，会向 API 发送 `AFK_MODE_BETA_HEADER` 以表示用户当前未在主动关注。

这在长时间运行的会话中非常有用 -- 例如，如果你启动了一个大规模重构任务然后 30 分钟后回来，离开摘要会给你一个简明的回顾：完成了什么、失败了什么、以及在你不在时做了哪些决策。

---

<Aside type="note">
所有这些功能都受到 Anthropic 内部构建标志和 GrowthBook 运行时检查的门控。在 Claude Code 的公开版本中无法启用这些功能，除非从源码重新构建并修改特性门控配置。
</Aside>
