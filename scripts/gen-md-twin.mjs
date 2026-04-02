/**
 * gen-md-twin.mjs
 *
 * Reads every .mdx file under src/content/docs/, strips frontmatter and
 * Astro/Starlight admonition blocks (:::note / :::caution / :::tip etc.),
 * then writes plain .md files into public/ at the same relative paths.
 *
 * Result: the Astro static server (dev or preview) serves the original
 * Starlight HTML unchanged, while agents can fetch raw Markdown via
 *   GET /claude-code-hidden-features/<slug>.md
 *
 * Usage:
 *   node scripts/gen-md-twin.mjs
 *   # or add to package.json scripts and call before astro build
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, relative, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DOCS_DIR = join(ROOT, 'src', 'content', 'docs')
const PUBLIC_DIR = join(ROOT, 'public')

/** Strip YAML frontmatter block (--- ... ---) */
function stripFrontmatter(src) {
  return src.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '')
}

/** Convert Astro admonition blocks to plain blockquotes */
function convertAdmonitions(src) {
  const lines = src.split('\n')
  const out = []
  let inAdmonition = false

  for (const line of lines) {
    const openMatch = line.match(/^:::(\w+)(?:\[([^\]]*)\])?\s*$/)
    const closeMatch = line.match(/^:::\s*$/)

    if (openMatch) {
      inAdmonition = true
      const label = openMatch[2] || openMatch[1].charAt(0).toUpperCase() + openMatch[1].slice(1)
      out.push(`> **${label}**`)
      continue
    }
    if (closeMatch && inAdmonition) {
      inAdmonition = false
      out.push('')
      continue
    }
    out.push(inAdmonition ? `> ${line}` : line)
  }
  return out.join('\n')
}

async function* walkMdx(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walkMdx(full)
    else if (entry.name.endsWith('.mdx')) yield full
  }
}

let count = 0
for await (const srcPath of walkMdx(DOCS_DIR)) {
  const rel = relative(DOCS_DIR, srcPath)           // e.g. "zh/01-foo.mdx"
  const mdRel = rel.replace(/\.mdx$/, '.md')        // "zh/01-foo.md"
  const destPath = join(PUBLIC_DIR, mdRel)

  const raw = await readFile(srcPath, 'utf8')
  const cleaned = convertAdmonitions(stripFrontmatter(raw))

  await mkdir(dirname(destPath), { recursive: true })
  await writeFile(destPath, cleaned, 'utf8')
  console.log(`  wrote: public/${mdRel}`)
  count++
}
console.log(`\nDone — ${count} .md files written to public/`)
