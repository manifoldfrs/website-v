#!/usr/bin/env node
/**
 * Create a new blog post stamped with today's date.
 *
 * Run:  pnpm run new-post "Why's everyone getting hacked?"            -> whys-everyone-getting-hacked.md
 *       pnpm run new-post "Why's everyone getting hacked?" hackermans -> hackermans.md
 */

import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const [title, slugArg] = process.argv.slice(2)
if (!title) {
  console.error('✗ Usage: pnpm run new-post "Post title" [slug]')
  process.exit(1)
}

const slug = (slugArg ?? title)
  .toLowerCase()
  .replace(/['’]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
if (!slug) {
  console.error("✗ Could not derive a slug from the title; pass one as the second argument")
  process.exit(1)
}

const file = join("src", "content", "posts", `${slug}.md`)
if (existsSync(file)) {
  console.error(`✗ ${file} already exists`)
  process.exit(1)
}

// en-CA formats as YYYY-MM-DD in local time, so a late-night post keeps today's date.
const date = new Date().toLocaleDateString("en-CA")

writeFileSync(
  file,
  `---
layout: post
title: ${JSON.stringify(title)}
date: ${date}
categories:
  - Posts
---

`,
)

console.log(`✓ Created ${file}`)
