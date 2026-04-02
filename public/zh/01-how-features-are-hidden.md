> **免责声明**
> 本文所有分析均基于某个版本的 Claude Code 源码 [instructkr/claude-code](https://github.com/instructkr/claude-code)。Claude Code **并非**开源项目，所有知识产权归 **Anthropic** 所有。本文仅为独立的源代码分析。


Anthropic 的 Claude Code 有一个版本的源码可在 [instructkr/claude-code](https://github.com/instructkr/claude-code) 获取。你可以阅读每一个文件。但阅读代码和 *运行* 代码是两回事。通过 `npm` 安装的公开构建版本缺少了整个功能系统 -- 不是因为它们在私有仓库里，而是因为它们在构建时被 **编译移除** 了。

本文将深入解析使这一切成为可能的三层门控系统。

---

## 第一层：构建期门控

第一层也是最有效的一层，在编译时运作。被此层门控的功能在公开构建中完全不存在。

### `USER_TYPE` 标志

最普遍的门控是一个简单的环境变量检查：

```typescript
if (process.env.USER_TYPE === 'ant') {
  // This entire block is removed in public builds
  enableInternalFeature()
}
```

这个检查在代码库的 **143+ 个文件中出现了 291+ 次**。在构建过程中，Bun 打包器通过 `--define` 标志被调用：

```bash
# Internal build
bun build --define process.env.USER_TYPE="'ant'" src/index.ts

# Public build
bun build --define process.env.USER_TYPE="'external'" src/index.ts
```

当打包器看到 `process.env.USER_TYPE === 'ant'` 且已知值为 `'external'` 时，它会在编译期将条件求值为 `false`。整个 `if` 代码块 -- 包括它触发的所有导入 -- 都会被作为死代码消除。

> **为什么这种方式如此有效**
> 死代码消除 (Dead Code Elimination) 不仅仅是为了隐藏功能，它还能减小包体积。你无法通过修补二进制文件来启用这些功能，因为代码根本就不在那里。


### `feature()` 函数

第二种构建期机制使用了 Bun 的打包时宏系统：

```typescript
import { feature } from 'bun:bundle'

if (feature('KAIROS')) {
  const { registerKairos } = require('./assistant/index.js')
  registerKairos()
}
```

共有 **89 个编译期特性标志** 使用了这种模式。在内部构建中，`feature('KAIROS')` 求值为 `true`，代码被保留。在公开构建中，它求值为 `false`，打包器会将整个代码块剥离。

以下是我们识别出的部分代表性标志：

| 标志 | 用途 |
|---|---|
| `COORDINATOR_MODE` | 多智能体协调者编排 |
| `FORK_SUBAGENT` | 缓存优化的子代理生成 |
| `KAIROS` | 基于定时/cron 的代理执行 |
| `HEARTH` | 持久化后台服务 |
| `MCP_AUTH` | MCP 服务器连接的 OAuth 认证 |
| `NOTEBOOK` | Jupyter Notebook 支持 |
| `GITHUB_PR` | 深度 GitHub PR 集成 |
| `INTEROP` | 跨工具集成协议 |

这种模式是一致的。`feature()` 调用包裹了一个动态 `require()`，因此标志背后的整个模块树也会被消除：

```typescript
// This pattern ensures the ENTIRE module graph is removed
if (feature('COORDINATOR_MODE')) {
  const { CoordinatorMode } = require('./coordinator/coordinatorMode.js')
  const { registerCoordinatorTools } = require('./coordinator/tools.js')
  // ... all coordinator code, including sub-dependencies
}
```

> **无法重新启用**
> 与运行时标志不同，构建期门控无法通过设置环境变量或修改配置文件来绕过。代码路径在编译输出中是物理缺失的。你需要使用内部标志从源码重新构建 -- 即便如此，第二层也会阻止你。


### 条件导入与注册

许多功能使用了一种注册模式，通过构建期门控来控制整个子系统是否被注册：

```typescript
// In the tool registration file
const tools: Tool[] = [
  BashTool,
  ReadTool,
  EditTool,
  // ... public tools
]

if (process.env.USER_TYPE === 'ant') {
  const { CoordinatorTool } = require('./tools/coordinator.js')
  const { SwarmTool } = require('./tools/swarm.js')
  tools.push(CoordinatorTool, SwarmTool)
}
```

这意味着内部构建拥有严格更大的工具集、额外的系统提示 (System Prompt) 部分，以及比公开构建更多的 CLI 标志。

---

## 第二层：运行时门控 (GrowthBook)

即使代码在构建过程中幸存下来，第二层服务端特性标志也会控制哪些功能实际执行。

### `tengu_*` 标志系统

Anthropic 使用 [GrowthBook](https://www.growthbook.io/) 进行运行时特性标志管理。代码库中引用了 **500+ 个特性标志**，全部以 `tengu_` 为前缀：

```typescript
const isSwarmEnabled = await getFeatureValue_CACHED_WITH_REFRESH(
  'tengu_amber_flint',
  false
)
if (!isSwarmEnabled) {
  return // Swarms disabled for this user
}
```

访问函数揭示了一种为 CLI 性能而设计的缓存策略：

| 函数 | 行为 |
|---|---|
| `getFeatureValue_CACHED_MAY_BE_STALE()` | 立即返回缓存值，可能已过期 |
| `getFeatureValue_CACHED_WITH_REFRESH()` | 返回缓存值，同时触发后台刷新 |

我们识别出的关键运行时标志：

| 标志 | 控制内容 |
|---|---|
| `tengu_amber_flint` | 智能体集群的终止开关 (Killswitch) |
| `tengu_kairos_cron` | Kairos 定时执行 |
| `tengu_onyx_plover` | Auto Dream / 记忆整合 |
| `tengu_scratch` | Scratchpad 跨工作者存储 |
| `tengu_hearth_daemon` | 后台服务持久化 |

### 内部覆盖

Anthropic 的开发者可以使用环境变量在本地覆盖任何运行时标志：

```bash
export CLAUDE_INTERNAL_FC_OVERRIDES='{"tengu_amber_flint": true, "tengu_kairos_cron": true}'
```

这个 JSON 对象在启动时被解析，并覆盖 GrowthBook 的响应。它只有在与内部认证 (第三层) 结合时才起作用，因此作为外部用户设置此变量不会有任何效果。

> **服务端强制执行**
> GrowthBook 标志在服务端根据你的认证上下文进行评估。即使你反编译客户端并修改标志检查，服务器也不会提供启用功能所需的标志值。客户端问"对我来说 `tengu_amber_flint` 是否启用？"，服务器回答"否"。


---

## 第三层：认证与上下文门控

最后一层使用认证状态和环境上下文来进行功能门控。

### Anthropic OAuth

```typescript
if (isAnthropicAuthEnabled()) {
  // Features only available when authenticated via Anthropic's internal OAuth
  registerInternalDashboard()
}
```

`isAnthropicAuthEnabled()` 函数检查一个 Anthropic 专属的 OAuth 令牌，该令牌只能通过 Anthropic 的内部身份提供者获取。这不同于 Claude API 密钥 -- 这是一个企业级 SSO 凭证。

### 订阅层级检查

```typescript
const tier = await getSubscriptionType()
// Returns: 'max' | 'pro' | 'plus' | 'basic'

if (tier === 'max') {
  enableMaxFeatures()
}
```

某些功能通过订阅层级而非员工身份来门控。`max` 层级是最高等级，解锁了 `pro` 和 `plus` 无法访问的功能。

### Monorepo 检测

```typescript
if (process.env.MONOREPO_ROOT_DIR) {
  // Running inside Anthropic's internal monorepo
  // Enable deep integration with internal tooling
  const { loadInternalConfig } = require('./internal/config.js')
  loadInternalConfig(process.env.MONOREPO_ROOT_DIR)
}
```

当 Claude Code 检测到自己正在 Anthropic 的内部 monorepo 中运行时（通过 `MONOREPO_ROOT_DIR` 环境变量），它会解锁与内部开发工具、自定义 linter 和专有工作流的集成。

### MDM 策略

```typescript
const mdmPolicy = await getMDMPolicy()
if (mdmPolicy?.enableAdvancedFeatures) {
  // Enterprise MDM-controlled feature gates
}
```

企业客户可以通过移动设备管理 (MDM) 策略控制 Claude Code 的功能，增加了又一层组织级的功能控制。

---

## 数据总结

以下是门控系统规模的汇总：

| 层级 | 机制 | 数量 |
|---|---|---|
| 构建期 | `process.env.USER_TYPE === 'ant'` 检查 | **143+** 个文件中 **291+** 处 |
| 构建期 | `feature()` 编译期标志 | **89** 个不同标志 |
| 运行时 | `tengu_*` GrowthBook 标志 | **500+** 个服务端标志 |
| 认证 | OAuth + 订阅 + MDM 门控 | 多个独立检查 |
| **总计** | **主要隐藏功能系统** | **24+** 个 |

最终的结果是，代码库中大约 30-40% 的已实现功能对外部用户不可见 -- 不是隐藏在某个设置开关后面，而是在分发的二进制文件中物理缺失。源代码是了解 Anthropic 正在构建什么的一扇窗口，但你安装的产品只是一个精心筛选的子集。

---

> **下一篇**
> 既然你已经理解了功能是如何被隐藏的，让我们来看看其中最令人印象深刻的一项：[协调者模式与智能体集群](/claude-code-hidden-features/zh/02-coordinator-swarms/)。

