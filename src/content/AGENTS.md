# AGENTS.md (src/content)

## Package Identity
- Markdown posts that power the blog.
- Parsed by the Effect blog service in `src/lib/blog/posts-service.ts`.

## Setup & Run
- `pnpm run dev`
- `pnpm run build`
- `pnpm run lint`

## Patterns & Conventions
- ✅ DO: Keep posts under `src/content/posts/` like `src/content/posts/interlude.md`.
- ✅ DO: Create posts with `pnpm run new-post "Title" [slug]`; it writes `slug.md` with today's date.
- ✅ DO: Use filename format `slug.md`; the filename is the URL slug (see `src/content/posts/neo-sparta.md`).
- ✅ DO: Include frontmatter fields `layout`, `title`, `date` (`YYYY-MM-DD`), `categories` (see `src/content/posts/interlude.md`).
- ✅ DO: Structure long posts with headings like `src/content/posts/neo-sparta.md`.
- ✅ DO: Reference images from `public/images` with `/images/...` paths (see `src/content/posts/interlude.md`).
- ❌ DON'T: Add a time to `date`; dates render in UTC, so evening Pacific times show the next day.
- ❌ DON'T: Rename a published post file; that changes its URL.

## Touch Points / Key Files
- Posts directory: `src/content/posts/`
- Post example: `src/content/posts/interlude.md`
- Long-form example: `src/content/posts/neo-sparta.md`
- New post script: `scripts/new-post.ts`
- Slug rules: `src/lib/blog/slug.ts`
- Frontmatter validation: `src/lib/blog/posts-service.ts`

## JIT Index Hints
- Find frontmatter blocks: `rg -n "^---" src/content/posts`
- Find titles: `rg -n "^title:" src/content/posts`
- Find dates: `rg -n "^date:" src/content/posts`
- Find images: `rg -n "/images/" src/content/posts`
- Find categories: `rg -n "^categories:" src/content/posts`

## Common Gotchas
- Missing `title` or `date` will throw during parsing.
- Posts are ordered by frontmatter `date`; the filename is only the slug.

## Pre-PR Checks
- `pnpm run lint && pnpm run build`
