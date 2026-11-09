# heyfar.is

Faris Habib's personal website, built with Next.js 16. The homepage is a record player playing a vinyl cut of a song, and the whole site uses the turntable's palette.

## Stack

- Next.js App Router, React 19, and strict TypeScript
- Tailwind CSS v4 and native CSS view transitions
- Georgia for headings and prose, system monospace for navigation and dates
- Markdown posts loaded through the Effect-based `src/lib/blog` API
- A WebGL2 + Web Audio turntable remixed from [rauchg/vinyl](https://github.com/rauchg/vinyl) (MIT), in `public/vinyl`
- A black-and-white Scotland photo on the about page

## Changing the record

```bash
bun scripts/vinyl-lathe.mjs "path/to/song.mp3"
```

This needs `ffmpeg`. It cuts the song into a groove and writes `public/vinyl/assets/`; then set the title in `public/vinyl/src/records.js`. Keep each `record.flac` under 25 MiB (about four minutes of music).

## Development

```bash
bun install
bun run dev
```

## Writing a post

```bash
bun run new-post "Why's everyone getting hacked?" hackermans
```

This creates `src/content/posts/hackermans.md` with today's date in its frontmatter. The slug is optional and defaults to one derived from the title. The filename becomes the post's URL (`/blog/hackermans`), so don't rename a post after it's published. Posts are ordered by their `date` (`YYYY-MM-DD`), which is shown as written, with no time or timezone.

## Validation

```bash
bun run lint
bun x tsc --noEmit
bun test src/components/site.test.tsx
bun run build
```

## Structure

- `src/app`: home, about, writing index, and individual posts
- `src/components`: navigation, footer, artwork, and post presentation
- `src/lib/blog`: markdown parsing, frontmatter validation, and post loading
- `src/content/posts`: published Markdown files, one `slug.md` per post
- `scripts`: the `new-post` generator and music visualizer tooling
- `public/images`: site and post artwork

The contact form and Spotify callback are no longer public routes. The site does not load the Spotify player.

The hero's facets are precomputed in `public/images/creation-of-adam.svg`; the browser does not need to triangulate the source painting. Its entrance animation runs once and shows a still image when reduced motion is requested.

Internal links retain normal anchor behavior and deliberately use document navigation to enable native cross-document view transitions. Browsers without that feature navigate normally.
