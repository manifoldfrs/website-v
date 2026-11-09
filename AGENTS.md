# AGENTS.md (root)

## Project Snapshot
- Repo type: single Next.js application (App Router) with no workspaces.
- Stack: Next.js 16, React 19, TypeScript strict, Tailwind CSS v4, Effect.js, and a raw WebGL2 + Web Audio record player on the homepage.
- Primary data path: markdown posts in `src/content/posts` loaded via `src/lib/blog`.
- This is a content+experience site with a client-side visual layer but server-rendered routing and pages.

## Instruction Hierarchy
- Always apply root rules first.
- Before touching a path, read the closest `AGENTS.md` in that directory subtree.
- Mandatory checks to route by scope:
  - `src/app/AGENTS.md`
  - `src/components/AGENTS.md`
  - `src/lib/AGENTS.md`
  - `src/content/AGENTS.md`
- If instructions conflict, follow the most specific file in the target directory.

## Tooling and Setup
- Install dependencies: `bun install`
- Run local dev server: `bun run dev`
- Build production bundle: `bun run build`
- Start production server: `bun run start`
- Lint project: `bun run lint`
- New blog post: `bun run new-post "Title" [slug]`
- Typecheck: `bun x tsc --noEmit`

## Primary Validation Commands
- No dedicated test script is defined in this repository.
- Replace "tests" with focused verification from lint/typecheck/build.
- Fast path for local edits: `bun run lint`.
- Full path for PRs: `bun run lint && bun x tsc --noEmit && bun run build`.
- For targeted checks when investigating one file:
  - `bun run lint src/app/page.tsx`
  - `bun run lint src/components/hero.tsx`
  - `bun x tsc --noEmit --pretty false`
- For content changes only, run:
  - `bun run build` (ensures blog route generation and markdown pipelines work)

## Core Conventions
- Use TypeScript strict everywhere; avoid `any` unless documented with a short reason and TODO.
- Use named exports by default.
- Keep filenames in kebab-case when possible (e.g. `post-list.tsx`, `page.tsx`).
- Prefer the `@/` alias from `tsconfig.json` for internal imports.
- Prefer double quotes in TypeScript/JSX.
- No semicolons in TypeScript and CSS snippets.
- Keep route modules thin; move reusable logic into `src/lib` or `src/components`.
- Use `await` and explicit error handling instead of silent fallback values.
- Use early returns for guard clauses and readable branching.

## React and Next Patterns
- App Router server components are default.
- Mark client-only files with `"use client"` before React imports when using hooks, state, or browser-only APIs.
- Use server actions for mutations (`"use server"`) and keep API/side-effect code out of route components.
- Prefer async server components with direct data loading (`async function ...()`).
- Use dynamic segments and `params` typing patterns that match current Next behavior.
- Use `generateStaticParams`, `generateMetadata`, and canonical metadata objects where useful.
- Keep `globals.css` import in `src/app/layout.tsx` only.
- Use `next/link` for internal navigation, `next/image` for raster content where performance matters.

## Effect.js and Data Layer Rules
- Blog access should flow through the public `src/lib/blog` API (`getAllPosts`, `getPostBySlug`, etc.).
- When writing effects in pages/actions, use explicit `Effect.runPromise` entrypoints.
- Preserve frontmatter shape via schema validation (Zod).
- Keep markdown parsing and slug derivation inside library modules; routes should avoid file system internals.
- Prefer pure utility functions for transformations and reserve side effects for service layers.

## Error Handling Standards
- Fail loudly in library/service boundaries, then map to route-safe user messages at UI boundaries.
- In route components, render explicit fallback UI for missing/error states.
- Do not swallow parsing or content-loading errors unless there is a deliberate fallback with telemetry/logging plan.
- Keep thrown error classes narrow and intentional.

## Content and Markdown Rules
- Posts must live under `src/content/posts` as `slug.md`; create them with `bun run new-post "Title" [slug]`.
- Keep required frontmatter fields present and valid (at least `layout`, `title`, `date` as `YYYY-MM-DD`, `categories`).
- Maintain markdown structure with clear heading hierarchy.
- Reference assets from `public/images` using site-root relative paths (no hardcoded external-only shortcuts).
- Keep post content readable in raw markdown; avoid adding JSX wrappers unless required by markdown renderer behavior.

## UI/Component Rules
- Use `data-cursor-hover` for cursor-target interactions where relevant.
- Prefer semantic tags and accessible labels for interactive elements.
- Keep 3D/visual-heavy modules isolated and loaded client-only when necessary.
- For motion, keep transitions purposeful and avoid excessive autoplay loops that increase CPU on first paint.
- Avoid placing heavy WebGL/Canvas code in multiple files; centralize in the established component.
- The homepage turntable is remixed from rauchg/vinyl (MIT): plain ES modules in `public/vinyl/src`, outside the bundler. `src/components/turntable.tsx` renders the markup `public/vinyl/src/main.js` finds by id, once, in the root layout, so the music keeps playing across client-side navigation; on other pages only the now-playing pill shows. Internal links must stay client-side (`TransitionLink`), or a full page load stops the music. Keep `public/vinyl/LICENSE`. Cut a new record with `bun scripts/vinyl-lathe.mjs <audio-file>`.

## Security and Privacy
- Secrets belong in `.env.local` only.
- Set `RESEND_API_KEY` for contact forms.
- Never commit `.env`, `.env.local`, or generated secrets.
- Avoid logging PII, full form payloads, API tokens, or raw emails in application logs.
- Validate input server-side for any public endpoint before side effects.

## Git and Change Hygiene
- Do not run destructive VCS resets or checkouts unless explicitly requested.
- Avoid reverting unrelated changes from prior contributors/workstreams.
- Keep edits scoped to intent.
- Prefer minimal hunks and avoid broad reformatting.
- If you need to move files, keep path and import updates consistent.

## Performance and Delivery Checks
- Keep render logic focused and avoid unnecessary client boundaries.
- Prefer static generation and caching strategies already used by routes.
- For any `next/dynamic` usage, ensure SSR boundary decisions are intentional.
- Validate mobile and desktop layouts after animation/layout changes.

## Quick discovery commands
- Find app routes: `rg -n "export default" src/app`
- Find server actions: `rg -n "\"use server\"" src/app`
- Find client islands: `rg -n "\"use client\"" src`
- Find components: `rg -n "export function|export const" src/components`
- Find blog data usage: `rg -n "getAllPosts|getPostBySlug|Effect.runPromise" src`
- Find content files: `rg -n "^---" src/content/posts`
- Find frontmatter fields quickly: `rg -n "^title:|^date:|^categories:" src/content/posts`

## Scope-Specific Touchpoints
- App routes and layouts: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx`, `src/app/contact/actions.ts`
- Shared UI: `src/components/sidebar.tsx`, `src/components/footer.tsx`, `src/components/post-list.tsx`, `src/components/post-body.tsx`
- Blog service boundary: `src/lib/blog/index.ts`, `src/lib/blog/posts-service.ts`, `src/lib/blog/markdown.ts`, `src/lib/blog/slug.ts`, `src/lib/utils.ts`
- Markdown examples: `src/content/posts/*`

## Common Gotchas
- `params` from dynamic routes can be asynchronous in current Next versions; type accordingly.
- Keep all global styles imported from one place (`src/app/layout.tsx`).
- WebGL/animation modules should remain client-only and not break SSR.
- Contact action logic belongs in `src/app/contact/actions.ts`, not directly in component render code.

## Optional AI Editing Rules
- No `.cursor/rules/*.md` directory present in this repo.
- No `.cursorrules` file present.
- No `copilot-instructions.md` present in `.github` or root.
- If such files appear later, treat them as highest priority under their own scope.

## Definition of Done
- `bun run lint` passes.
- `bun x tsc --noEmit` passes.
- `bun run build` passes.
- Scope-specific AGENTS instructions are followed.
- Public content updates are visible and posts remain valid.
- No secrets or generated credentials committed.
