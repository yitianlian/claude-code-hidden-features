import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://yitianlian.github.io',
  base: '/claude-code-hidden-features',
  integrations: [
    starlight({
      title: 'Claude Code Hidden Features',
      description: 'Analyzing Claude Code\'s hidden features that only Anthropic employees can use.',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        zh: { label: '中文', lang: 'zh-CN' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/yitianlian/claude-code-hidden-features' },
      ],
      sidebar: [
        {
          label: 'Overview',
          translations: { 'zh-CN': '概述' },
          slug: 'index',
        },
        {
          label: 'How Features Are Hidden',
          translations: { 'zh-CN': '功能是如何被隐藏的' },
          slug: '01-how-features-are-hidden',
        },
        {
          label: 'Coordinator & Agent Swarms',
          translations: { 'zh-CN': 'Coordinator 与 Agent Swarms' },
          slug: '02-coordinator-swarms',
        },
        {
          label: 'KAIROS, Dream & Cron',
          translations: { 'zh-CN': 'KAIROS、Dream 与定时任务' },
          slug: '03-kairos-dream-cron',
        },
        {
          label: 'Voice, Browser & Remote',
          translations: { 'zh-CN': '语音、浏览器与远程' },
          slug: '04-voice-browser-remote',
        },
        {
          label: 'Auto Mode & Buddy',
          translations: { 'zh-CN': 'Auto 模式与 Buddy' },
          slug: '05-auto-mode-buddy',
        },
        {
          label: 'All Feature Flags',
          translations: { 'zh-CN': '完整 Feature Flags 清单' },
          slug: '06-all-feature-flags',
        },
        {
          label: 'How to Enable',
          translations: { 'zh-CN': '如何开启隐藏功能' },
          slug: '07-how-to-enable',
        },
      ],
    }),
  ],
});
