#!/usr/bin/env node
/**
 * Fetch the playlist's track list from Spotify's public embed page and write it to
 * src/lib/spotify/tracks.json (committed static data the site reads at runtime).
 *
 * Why the embed instead of the Web API: Spotify now returns 403 on playlist items
 * for new apps — even with a user token. The public embed page bootstraps with the
 * same track list, so we read that. No credentials, no login. Re-run after editing
 * the playlist. (This depends on Spotify's embed markup; if it ever breaks, the
 * script will say so — ping me and I'll adjust the parser.)
 *
 * Run:  node scripts/fetch-tracks.ts
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

const PLAYLIST_ID = "27YnAWdvBHYT7Ekhko0Vwp"
const OUT = join("src", "lib", "spotify", "tracks.json")

const res = await fetch(`https://open.spotify.com/embed/playlist/${PLAYLIST_ID}`, {
  headers: { "User-Agent": "Mozilla/5.0" },
})
if (!res.ok) {
  console.error("✗ Failed to load the embed page:", res.status)
  process.exit(1)
}

const html = await res.text()
const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
if (!m) {
  console.error("✗ Could not find __NEXT_DATA__ in the embed page (Spotify changed its markup).")
  process.exit(1)
}

const data = JSON.parse(m[1])
const entity = data?.props?.pageProps?.state?.data?.entity
const list = entity?.trackList
if (!Array.isArray(list)) {
  console.error("✗ No trackList found in the embed data.")
  process.exit(1)
}

const sources: { url: string; width: number }[] = entity?.coverArt?.sources ?? []
const cover: string | null = sources.length
  ? sources.reduce((a, b) => (b.width > a.width ? b : a)).url
  : null

type Track = { id: string; uri: string; name: string; artists: string; image: string | null; durationMs: number }
const tracks: Track[] = []
for (const t of list) {
  const uri: string = t.uri ?? ""
  const id = uri.split(":")[2]
  if (!id) continue
  tracks.push({
    id,
    uri,
    name: t.title ?? "",
    artists: t.subtitle ?? "",
    image: cover,
    durationMs: t.duration ?? 0,
  })
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(tracks, null, 2) + "\n")
console.log(`✓ Wrote ${tracks.length} tracks → ${OUT}`)
