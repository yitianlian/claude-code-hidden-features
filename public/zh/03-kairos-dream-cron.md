> **免责声明**
> 本文所有分析均基于某个版本的 Claude Code 源码 [instructkr/claude-code](https://github.com/instructkr/claude-code)。Claude Code **并非**开源项目，所有知识产权归 **Anthropic** 所有。本文仅为独立的源代码分析。


Claude Code 内部包含一套完整的自主代理操作系统，名为 **KAIROS**，大多数用户永远不会接触到它。启用后，它会将 Claude Code 从一个被动响应的助手转变为一个主动运行、始终在线的代理，能够执行后台任务、定时任务、推送通知以及自主记忆整合。

## KAIROS 系统

> **功能门控**
> 由 `feature('KAIROS')` 控制。这是启用 Claude Code "助手模式"的总开关 -- 一种与标准交互式 CLI 截然不同的运行模式。


KAIROS 并非单一功能，而是一个伞状系统，下辖多个子功能，每个子功能都有独立的特性标志 (Feature Flag)：

| 子功能 | 标志 | 用途 |
|---|---|---|
| **Channels** | `feature('KAIROS_CHANNELS')` | MCP 通道订阅，用于接收通知 |
| **GitHub Webhooks** | `feature('KAIROS_GITHUB_WEBHOOKS')` | 订阅 GitHub Webhook 事件 |
| **Push Notifications** | `feature('KAIROS_PUSH_NOTIFICATION')` | 向用户设备推送通知 |
| **Brief Mode** | `feature('KAIROS_BRIEF')` | 精简聊天 UI，带检查点和 5 分钟刷新周期 |

### KAIROS 解锁的工具

当 KAIROS 标志激活时，以下工具会在工具注册表中变为可用：

- **SleepTool** -- 暂停执行指定时长（用于轮询和定时调度）
- **SendUserFileTool** -- 直接向用户设备发送文件
- **PushNotificationTool** -- 在终端之外发送推送通知
- **SubscribePRTool** -- 订阅 Pull Request 事件并在变更时获得通知
- **BriefTool** -- 生成带检查点的进度摘要

### 环境变量

```
CLAUDE_CODE_PROACTIVE=1
```

设置此环境变量会在 KAIROS 框架下启用**主动模式**，允许 Claude 在无需等待用户提示的情况下主动采取行动。

---

## 主动模式 (Proactive Mode)

> **功能门控**
> 由 `feature('PROACTIVE')` 控制。需要 KAIROS 处于激活状态。


主动模式是 KAIROS 真正有趣的地方。Claude 不再等待用户输入，而是自主地：

1. **生成任务** -- 根据上下文识别需要完成的工作
2. **执行任务** -- 无需用户明确指令即可执行
3. **报告进度** -- 使用 Brief 工具提供结构化的进度更新
4. **推测下一步** -- 预先计算可能的后续操作（"推测执行"），以降低延迟

这使 Claude Code 更像一个后台队友，而非一个命令行工具。

---

## Auto Dream：后台记忆整合

> **仅限 Anthropic 内部**
> 由 `feature('KAIROS_DREAM')` 加 GrowthBook 标志 `tengu_onyx_plover` 控制。这是一个仅限内部使用的功能。


Auto Dream 是一个在后台运行的自主记忆整合系统。每 24 小时（可配置），如果累积了至少 5 个新会话，Claude 会派生一个 **fork 子代理**来执行以下操作：

1. 回顾过往会话记录
2. 提取模式、偏好和重复出现的上下文
3. 将整合后的记忆写入自动记忆目录

### 门控级联

Dream 系统使用多级门控来防止不必要或并发的运行：

```
Feature Flag Gate
    |
    v
Time Gate (24h since last run)
    |
    v
Session Gate (>= 5 new sessions)
    |
    v
Lock Gate (file-based lock prevents concurrent consolidations)
    |
    v
Dream Subagent Spawned
```

### 工具约束

Dream 子代理在受限沙箱中运行。它只能执行**只读 Bash 命令**：

- `ls`, `find`, `grep`, `cat`, `stat`, `wc`, `head`, `tail`

不允许写操作、不允许 git 操作、不允许网络调用。这确保了整合过程不会意外修改你的代码库。

### 遥测事件

| 事件 | 含义 |
|---|---|
| `tengu_auto_dream_fired` | 触发了 Dream 记忆整合 |
| `tengu_auto_dream_completed` | 整合成功完成 |
| `tengu_auto_dream_failed` | 整合遇到错误 |

---

## Cron 定时代理

> **仅限 Anthropic 内部**
> 由 `feature('AGENT_TRIGGERS')` 加 GrowthBook 标志 `tengu_kairos_cron` 控制。


Cron 系统允许你以标准 cron 表达式调度 Claude Code 代理运行 -- 将 Claude 变成一个可调度的后台工作者。

### CronCreate 工具

以 5 字段 cron 表达式调度一个提示词的执行：

- **循环或一次性** -- 设置 cron 模式或单次未来时间
- **持久化** -- 调度会持久化到 `.claude/scheduled_tasks.json`，重启后仍然有效
- **最大并发数** -- 最多 50 个并发定时任务
- **自动过期** -- 任务默认 7 天后过期

### 管理工具

- **CronList** -- 查看所有定时任务及其下次运行时间
- **CronDelete** -- 按 ID 删除定时任务

---

## 远程触发器 (Remote Triggers)

> **仅限 Anthropic 内部**
> 由 `feature('AGENT_TRIGGERS_REMOTE')` 加 GrowthBook 标志 `tengu_surreal_dali` 控制。


远程触发器通过 **RemoteTriggerTool** 将调度系统从本地 cron 扩展到 Anthropic 的云基础设施。

### 操作

| 操作 | 说明 |
|---|---|
| `create` | 注册新的远程触发器 |
| `list` | 列出所有活跃的触发器 |
| `get` | 获取特定触发器的详情 |
| `update` | 修改已有的触发器 |
| `run` | 手动执行一个触发器 |

### API 端点

远程触发器与 Anthropic 的后端通信：

```
POST   /v1/code/triggers
GET    /v1/code/triggers
GET    /v1/code/triggers/:id
PATCH  /v1/code/triggers/:id
POST   /v1/code/triggers/:id/run
```

> **功能门控**
> 需要 beta 请求头：`anthropic-beta: ccr-triggers-2026-01-30`


---

## 任务系统概览

在底层，KAIROS 通过一套类型化的任务系统来编排工作。每种任务类型对应不同的执行上下文：

| 任务类型 | 说明 |
|---|---|
| **DreamTask** | 后台记忆整合（Auto Dream） |
| **LocalAgentTask** | 在子进程中运行的本地代理 |
| **RemoteAgentTask** | 在 Anthropic 云基础设施上运行的代理 |
| **InProcessTeammateTask** | 与主会话在同一进程中运行的代理 |
| **LocalShellTask** | 原始 Shell 命令执行 |
| **MonitorMcpTask** | 长时间运行的 MCP 服务器监控任务 |

这种任务抽象使 KAIROS 能够统一管理、调度、取消和报告各种工作，无论它们在哪里或如何执行。
