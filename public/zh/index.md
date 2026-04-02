import { LinkCard, CardGrid } from '@astrojs/starlight/components';

> **免责声明**
> 本文所有分析均基于某个版本的 Claude Code 源码 [instructkr/claude-code](https://github.com/instructkr/claude-code)。Claude Code **并非**开源项目，所有知识产权归 **Anthropic** 所有。本文仅为独立的源代码分析。


我们逐行分析了 [某个版本的 Claude Code 源码](https://github.com/instructkr/claude-code)，发现了一套精心设计的多层特性门控系统 (Feature Gating)，将 **24+ 项完整实现的功能** 从公开构建版本中隐藏了起来。

这不是猜测。本站的每一项声明都有直接的源代码引用作为支撑。

## 隐藏的规模

| 指标 | 数量 |
|---|---|
| `process.env.USER_TYPE === 'ant'` 检查 | 分布在 **143+** 个文件中，共 **291+** 处 |
| 通过 `bun:bundle` 实现的编译期 `feature()` 标志 | **89** 个编译期门控 |
| 运行时 `tengu_*` GrowthBook 标志 | **500+** 个服务端特性标志 (Feature Flags) |
| 主要隐藏功能系统 | **24+** 个 |

当 Anthropic 为公开发布构建 Claude Code 时，Bun 打包器会评估每一个 `feature()` 调用和 `USER_TYPE` 检查。如果标志为 `false`，**死代码消除 (Dead Code Elimination) 会将整个代码路径剥离**。这些功能在你下载的二进制文件中根本不存在。

## 三句话解释其工作原理

1. **构建期**：`process.env.USER_TYPE` 仅在内部构建时设为 `'ant'`。打包器内联该值并消除不可达分支。
2. **编译期**：`bun:bundle` 中的 `feature('SOME_FLAG')` 在打包时返回 `true` 或 `false`。返回 `false` 的分支会被完全移除。
3. **运行时**：即使代码在打包阶段幸存，GrowthBook 特性标志 (`tengu_*`) 也会在服务端进行门控，对非 Anthropic 账户返回 `false`。

## 隐藏功能列表

以下是我们目前识别出的主要隐藏功能汇总：

| 功能 | 门控方式 | 描述 |
|---|---|---|
| 协调者模式 (Coordinator Mode) | `feature('COORDINATOR_MODE')` | 多智能体编排系统，由协调者将任务委派给并行的工作者 |
| Fork 子代理 (Fork Subagent) | `feature('FORK_SUBAGENT')` | 缓存优化的子代理，继承父对话历史 |
| 智能体集群 (Agent Swarms) | `tengu_amber_flint` | 领导者-队友模型，支持 tmux/iTerm 面板生成和共享内存 |
| Kairos | `feature('KAIROS')` | 定时后台代理执行，支持类 cron 触发器 |
| Auto Dream | `tengu_onyx_plover` | 自动化记忆整合与上下文摘要 |
| Scratchpad | `tengu_scratch` | 多智能体工作流的跨工作者持久化存储目录 |
| Hearth | `feature('HEARTH')` | 持久化后台服务与守护进程管理 |
| MCP 认证 (MCP Auth) | `feature('MCP_AUTH')` | 基于 OAuth 的 MCP 服务器连接认证 |
| Notebook 支持 | `feature('NOTEBOOK')` | 原生 Jupyter Notebook 编辑与执行 |
| GitHub PR 集成 | `feature('GITHUB_PR')` | 深度 Pull Request 审查与管理工作流 |
| Interop 模式 | `feature('INTEROP')` | 编辑器扩展的跨工具集成协议 |
| Prompt 缓存 | `ant` 门控 | 高级 Prompt 缓存管理与优化 |
| 自定义模型 | `ant` 门控 | 超出公开产品范围的内部模型选择 |
| MDM 策略 | `ant` 门控 | 移动设备管理 (MDM) 策略执行 |
| 遥测仪表板 | `ant` 门控 | 内部使用分析与性能监控 |
| 订阅层级 | `ant` 门控 | max/pro/plus/basic 层级间的功能差异化 |
| 权限桥接 (Permission Bridge) | `ant` 门控 | 跨智能体权限同步 |
| 团队记忆同步 (Team Memory Sync) | `ant` 门控 | 智能体团队间的共享上下文传播 |
| Monorepo 检测 | `MONOREPO_ROOT_DIR` | 在 Anthropic 内部 monorepo 中运行时的特殊功能 |
| 插件系统 | `ant` 门控 | 超出公开 MCP 范围的扩展插件架构 |
| 后台任务 | `ant` 门控 | 带进度跟踪的长时间运行任务管理 |
| 会话交接 (Session Handoff) | `ant` 门控 | 在设备/实例之间转移活跃会话 |
| 智能重试 (Smart Retry) | `ant` 门控 | 带退避策略的智能请求重试 |
| 配置同步 (Config Sync) | `ant` 门控 | 跨设备配置同步 |

## 深入解析

<CardGrid>
  <LinkCard
    title="Anthropic 如何在众目睽睽之下隐藏功能"
    description="三层门控系统：构建期消除、运行时标志与认证门控。"
    href="/claude-code-hidden-features/zh/01-how-features-are-hidden/"
  />
  <LinkCard
    title="协调者模式：隐藏的多智能体乐团"
    description="多工作者编排、Fork 子代理与共享内存的智能体集群。"
    href="/claude-code-hidden-features/zh/02-coordinator-swarms/"
  />
</CardGrid>

---

> **免责声明**
> 本站所有分析均基于 [某个版本的 Claude Code 源码](https://github.com/instructkr/claude-code)。Claude Code 本身**并非**开源项目 — 该仓库仅代表某一特定版本的源代码。所有知识产权和荣誉归 **Anthropic** 所有。我们没有内部访问权限，与 Anthropic 没有任何关联。这里描述的功能可能会变更、被移除，或与我们的分析结果存在差异。这是源代码考古，不是官方文档。

