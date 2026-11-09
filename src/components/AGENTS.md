# AGENTS.md (src/components)

## Package Identity
- Reusable UI components for the site.
- Minimal, document-style layout inspired by mitchellh.com. Mostly server components; client only where interaction requires it.

## Setup & Run
- `bun run dev`
- `bun run build`
- `bun run start`
- `bun run lint`
- `bun x tsc --noEmit`

## Design System
- Theme tokens live in `src/app/globals.css` and match the homepage turntable: near-black background (`#0c0c0d`) under a soft grey radial light, warm off-white text (`#e8e4dd`), warm grays for prose and muted text, and one amber accent (`#ffb454`) for links, focus, and highlights.
- Fonts (loaded in `src/app/layout.tsx`, exposed as CSS vars / Tailwind families):
  - `font-display` → Archivo (expanded width). Apply the `.display` class for the wordmark and large numerals (uppercase, widest width axis).
  - `font-serif` → IBM Plex Serif. Default body font; used for prose.
  - `font-sans` → IBM Plex Sans. Headings inside content, post titles.
  - `font-mono` → IBM Plex Mono. Nav, labels, dates, code.
- The page shell (sidebar + masthead + footer) lives in `src/app/layout.tsx`. Pages render content only.

## Patterns & Conventions
- ✅ DO: Keep component filenames kebab-case, e.g., `src/components/post-list.tsx`.
- ✅ DO: Use named exports like `export function Sidebar` in `src/components/sidebar.tsx`.
- ✅ DO: Add `"use client"` only when a component needs hooks/browser APIs (see `src/components/sidebar.tsx`, which uses `usePathname`).
- ✅ DO: Prefer server components. `post-list.tsx`, `post-body.tsx`, and `footer.tsx` are plain server components.
- ✅ DO: Use `next/link` for internal navigation (see `src/components/sidebar.tsx`).
- ✅ DO: Use Tailwind theme tokens from `globals.css` (`text-muted-foreground`, `text-accent`, `bg-background`).
- ✅ DO: Keep motion minimal — CSS transitions for hover/active states. No animation libraries.
- ❌ DON'T: Add Framer Motion, React Three Fiber, Lenis, or a custom cursor back in. Pages are static and minimal; the only canvas is the homepage turntable (`turntable.tsx`, engine in `public/vinyl/src`).
- ❌ DON'T: Use `dangerouslySetInnerHTML` unless rendering already-sanitized markdown like `src/components/post-body.tsx`.

## Touch Points / Key Files
- Sidebar nav (avatar + links, active state): `src/components/sidebar.tsx`
- Footer (copyright + social icons): `src/components/footer.tsx`
- Blog list: `src/components/post-list.tsx`
- Blog content renderer: `src/components/post-body.tsx`
- Page shell, fonts, masthead: `src/app/layout.tsx`

## JIT Index Hints
- Find components: `rg -n "export function" src/components`
- Find client components: `rg -n "\"use client\"" src/components`
- Find theme tokens: `rg -n "accent|muted-foreground|font-display" src/components`

## Common Gotchas
- The sidebar uses `usePathname` for active-link state, so it must stay a client component.
- The `.display` class sets `font-stretch: 125%`; it only works because Archivo is loaded with the `wdth` axis in `layout.tsx`.
- Do not set `overflow` on `body`/`html`; it breaks the sidebar's `position: sticky`.

## Pre-PR Checks
- `bun run lint && bun x tsc --noEmit && bun run build`
