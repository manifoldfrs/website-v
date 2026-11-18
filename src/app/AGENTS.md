# AGENTS.md (src/app)

## Package Identity
- Next.js App Router routes, layouts, metadata, and server actions for heyfar.is.
- Server components by default with client-only islands for interactivity.

## Setup & Run
- `pnpm run dev`
- `pnpm run build`
- `pnpm run start`
- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm test`

## Patterns & Conventions
- ✅ DO: Keep route files as `page.tsx` inside segment folders, e.g., `src/app/about/page.tsx`.
- ✅ DO: Export route metadata via `export const metadata` like `src/app/blog/page.tsx`.
- ✅ DO: Use `generateStaticParams` + `generateMetadata` for dynamic routes (see `src/app/blog/[slug]/page.tsx`).
- ✅ DO: Fetch blog data in async server components with `Effect.runPromise`, e.g., `src/app/blog/page.tsx`.
- ✅ DO: Use Suspense + skeleton fallbacks like `src/app/page.tsx`.
- ✅ DO: Separate server actions into `"use server"` files such as `src/app/contact/actions.ts`.
- ✅ DO: Mark client pages with `"use client"` when using hooks (see `src/app/contact/page.tsx`).
- ✅ DO: Import global styles only in `src/app/layout.tsx`.
- ✅ DO: Use `@/components` + `@/lib` aliases for shared code (see `src/app/page.tsx`).
- ❌ DON'T: Read `process.env` or call Resend in `src/app/contact/page.tsx`; keep it in `src/app/contact/actions.ts`.
- ❌ DON'T: Add new global CSS imports outside `src/app/layout.tsx`.

## Touch Points / Key Files
- Root layout + metadata: `src/app/layout.tsx`
- Global styles: `src/app/globals.css`
- Home route: `src/app/page.tsx`
- Blog list: `src/app/blog/page.tsx`
- Blog detail: `src/app/blog/[slug]/page.tsx`
- Contact form: `src/app/contact/page.tsx`
- Contact server action: `src/app/contact/actions.ts`
- Error boundaries: `src/app/error.tsx`, `src/app/not-found.tsx`

## JIT Index Hints
- Find pages: `rg -n "page.tsx" src/app`
- Find metadata exports: `rg -n "export const metadata" src/app`
- Find dynamic routes: `rg -n "\\[slug\\]" src/app`
- Find server actions: `rg -n "\"use server\"" src/app`
- Find error handling: `rg -n "error.tsx|not-found.tsx" src/app`

## Common Gotchas
- `params` is awaited in `src/app/blog/[slug]/page.tsx` (typed as a Promise).
- Only the root layout should import `globals.css`.
- Client components must declare `"use client"` before hooks.

## Pre-PR Checks
- `pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build`
