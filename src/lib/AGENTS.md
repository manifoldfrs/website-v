# AGENTS.md (src/lib)

## Package Identity
- Shared utilities and Effect-based blog data layer.
- Converts markdown posts in `src/content/posts` to HTML for routes.

## Setup & Run
- `pnpm run dev`
- `pnpm run build`
- `pnpm run start`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`

## Patterns & Conventions
- ✅ DO: Import blog APIs from `src/lib/blog/index.ts` (see `src/app/page.tsx`).
- ✅ DO: Keep file IO inside Effect services using `@effect/platform` (`src/lib/blog/posts-service.ts`).
- ✅ DO: Validate frontmatter with Zod (`frontmatterSchema` in `src/lib/blog/posts-service.ts`).
- ✅ DO: Derive slugs from filenames using `src/lib/blog/slug.ts`.
- ✅ DO: Convert markdown with `src/lib/blog/markdown.ts`.
- ✅ DO: Keep exported types in `src/lib/blog/types.ts`.
- ✅ DO: Use `cn` from `src/lib/utils.ts` for class merging.
- ❌ DON'T: Read markdown files directly in routes; go through `getAllPosts`/`getPostBySlug` in `src/lib/blog/index.ts`.
- ❌ DON'T: Import Node `fs` in new helpers; follow the Effect FileSystem in `src/lib/blog/posts-service.ts`.

## Touch Points / Key Files
- Blog service: `src/lib/blog/posts-service.ts`
- Blog public API: `src/lib/blog/index.ts`
- Markdown parsing: `src/lib/blog/markdown.ts`
- Slug utils: `src/lib/blog/slug.ts`
- Blog types: `src/lib/blog/types.ts`
- Class merge helper: `src/lib/utils.ts`

## JIT Index Hints
- Find Effect services: `rg -n "Effect\\.|FileSystem" src/lib/blog`
- Find frontmatter validation: `rg -n "frontmatterSchema" src/lib/blog/posts-service.ts`
- Find markdown helpers: `rg -n "markdownToHtml|extractExcerpt" src/lib/blog`
- Find slug logic: `rg -n "deriveSlugFromFilename" src/lib/blog`
- Find cn helper: `rg -n "export function cn" src/lib/utils.ts`

## Common Gotchas
- `POSTS_DIR` uses `process.cwd()`; run scripts from repo root.
- Slugs are the post filename without `.md` per `src/lib/blog/slug.ts`; posts sort by frontmatter `date`.
- Use `Effect.orElseSucceed` fallback like `src/app/page.tsx` when running effects in pages.

## Pre-PR Checks
- `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build`
