> **免责声明**
> 本站所有分析均基于某个版本的 Claude Code 源码 [instructkr/claude-code](https://github.com/instructkr/claude-code)。Claude Code 本身**并非**开源项目。所有知识产权和荣誉归 **Anthropic** 所有。本文是独立的源代码分析，不是官方文档，与 Anthropic 没有任何关联或背书。开启隐藏功能可能违反服务条款或导致意外行为，风险自负。


## 四层防御体系

根据我们的源码分析，隐藏功能受到四层门控保护：

| 层级 | 机制 | 能否绕过？ |
|------|------|-----------|
| **构建时** | `USER_TYPE === 'ant'` + `feature()` 标志 — 公开构建通过死代码消除物理移除了这些代码 | 需要从源码重新构建 |
| **运行时** | GrowthBook `tengu_*` 标志 — 服务端向 Anthropic 服务器查询 | 需要本地覆盖 (`CLAUDE_INTERNAL_FC_OVERRIDES`) |
| **认证** | 绑定到员工账户的 Anthropic OAuth 令牌 | 无法绕过 |
| **基础设施** | CCR、远程触发器、推送通知依赖 Anthropic 内部后端 | 无法绕过 |

## 值得关注的环境变量

部分功能通过环境变量进行门控：

```bash
CLAUDE_CODE_COORDINATOR_MODE=1          # 协调器模式
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1  # Agent 团队 (+ --agent-teams 标志)
CLAUDE_CODE_PROACTIVE=1                 # 主动模式
CLAUDE_INTERNAL_FC_OVERRIDES='{...}'    # GrowthBook 标志覆盖 (JSON 格式)
```

> **重要**
> 这些环境变量仅在对应的代码路径存在于你的构建中时才有效。在公开构建版本中，大多数功能代码已被 Tree-shaking 移除 — 环境变量没有可以激活的目标。


## 可行性速评

| 功能 | 可行性 | 原因 |
|------|--------|------|
| 协调器模式 | 推测 — 可能部分可行 | 最独立的功能；环境变量 + 源码重建 |
| Agent 团队 | 推测 — 可能部分可行 | 环境变量 + CLI 标志 + 源码重建 |
| 自动权限模式 | 推测 — 可能部分可行 | 客户端分类器 |
| Kairos（本地任务） | 推测 — 部分可行 | 本地守护进程可用，但无推送/Webhook |
| 语音模式 | 不太可能 | 可能依赖服务端音频管线 |
| CCR / 远程触发器 | 不可能 | 需要 Anthropic 的后端基础设施 |
| Bridge / SSH 远程 | 不可能 | 需要 Anthropic 的远程后端 |

## 推测性方案：从源码构建

> **推测**
> 以下内容是基于阅读构建系统的最佳猜测。我们**没有验证**这些步骤，它们可能不完整、过时或完全错误。


根据源码结构，理论上的方案大致如下：

```bash
# 1. 克隆源码
git clone https://github.com/instructkr/claude-code
cd claude-code

# 2. 安装 Bun（Claude Code 使用的运行时/打包器）
curl -fsSL https://bun.sh/install | bash

# 3. 安装依赖
bun install
```

关键是找到**构建配置文件** — 可能是 `build.ts`、`bundle.ts` 或 `package.json` 的 scripts 段。在构建管线的某处，应该有类似这样的 `--define` 标志：

```typescript
// 假设的构建配置（推测）
Bun.build({
  define: {
    'process.env.USER_TYPE': JSON.stringify('ant'),  // 把 'external' 改为 'ant'
    // feature() 标志可能也在这里定义
  },
})
```

你需要：

1. **找到**设置 `USER_TYPE` 和 `feature()` 定义的构建入口
2. **修改** `USER_TYPE` 从默认值（可能是 `'external'`）改为 `'ant'`
3. **启用**特定功能标志：`COORDINATOR_MODE: true`、`KAIROS: true` 等
4. **重新构建** — 使用 `bun build` 或项目的构建脚本
5. **替换**你已安装的 Claude Code 二进制文件

### GrowthBook 难题

即使有了自定义构建，运行时的 `tengu_*` 标志仍会查询 Anthropic 的 GrowthBook 服务器。覆盖环境变量可能有帮助：

```bash
# 在本地覆盖特定的 GrowthBook 标志
export CLAUDE_INTERNAL_FC_OVERRIDES='{
  "tengu_amber_flint": true,
  "tengu_kairos_cron": true,
  "tengu_onyx_plover": { "enabled": true, "minHours": 24, "minSessions": 5 },
  "tengu_scratch": true,
  "tengu_auto_mode_config": { "enabled": "enabled" }
}'
```

但这仅在以下条件满足时有效：
- `CLAUDE_INTERNAL_FC_OVERRIDES` 的代码路径存在于你的构建中（它在 `USER_TYPE === 'ant'` 之后）
- 功能代码本身没有被 tree-shaking 移除

### 最有希望的目标

如果要猜测哪些功能最可能通过源码重建来实现：

1. **Coordinator 模式** — 自包含，环境变量激活，无后端依赖
2. **Agent 团队** — 环境变量 + CLI 标志，使用本地 tmux/iTerm
3. **Auto Dream** — 基于本地文件，forked subagent 在本地运行
4. **自动权限模式** — 客户端分类器，无服务端依赖
5. **Scratchpad** — 只是一个带权限绕过的目录，非常简单

### 绝对不可能的部分

无论怎么改源码都无法复制：
- **CCR 云环境** — Anthropic 的私有云基础设施
- **远程触发器 API** (`/v1/code/triggers`) — Anthropic 的后端
- **推送通知** — Anthropic 的通知服务
- **Bridge 远程会话** — Anthropic 的环境 API
- **API Beta Header 门控的功能** — 服务端直接拒绝

## 待续 (To Be Continued...)

我们正在继续探索构建系统，如果找到可靠的方法会更新本页。目前最实用的收获是理解**这些功能的架构设计** — Coordinator/Worker 模式、缓存安全的 Fork、后台记忆整合、智能权限分类 — 这些架构模式可以启发你自己的 AI 工具开发。

---

> **来源**
> 所有分析基于：[github.com/instructkr/claude-code](https://github.com/instructkr/claude-code)

