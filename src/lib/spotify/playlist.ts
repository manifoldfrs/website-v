/**
 * Playlist track list.
 *
 * Spotify blocks app-only (client-credentials) access to playlist *items*, so we
 * read the list from Spotify's public embed page. This runs server-side at request
 * time with ISR caching, so new songs added to the playlist show up automatically
 * (within the revalidate window). The committed src/lib/spotify/tracks.json is a
 * fallback used if the live fetch ever fails (e.g. Spotify changes the embed markup);
 * refresh it with `node scripts/fetch-tracks.ts`.
 */

import fallbackData from "./tracks.json"

const PLAYLIST_ID = "27YnAWdvBHYT7Ekhko0Vwp"

export const PLAYLIST_URI = `spotify:playlist:${PLAYLIST_ID}`
export const PLAYLIST_URL = `https://open.spotify.com/playlist/${PLAYLIST_ID}`

// How often to re-check the playlist for changes (seconds).
const REVALIDATE_SECONDS = 1800

export type SpotifyTrack = {
  id: string
  uri: string
  name: string
  artists: string
  image: string | null
  durationMs: number
}

type EmbedTrack = { uri?: string; title?: string; subtitle?: string; duration?: number }
type EmbedData = {
  props?: {
    pageProps?: {
      state?: {
        data?: {
          entity?: {
            trackList?: EmbedTrack[]
            coverArt?: { sources?: { url: string; width: number }[] }
          }
        }
      }
    }
  }
}

const FALLBACK = fallbackData as unknown as SpotifyTrack[]

// The embed's coverArt can lag for hours after a cover change; the real playlist
// page's og:image meta updates much sooner, so prefer it for the cover.
async function fetchPlaylistCover(): Promise<string | null> {
  try {
    const res = await fetch(PLAYLIST_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; facebookexternalhit/1.1)" },
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return null
    const html = await res.text()
    const m = html.match(/<meta property="og:image" content="([^"]+)"/)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

export async function getPlaylistTracks(): Promise<SpotifyTrack[]> {
  try {
    const res = await fetch(`https://open.spotify.com/embed/playlist/${PLAYLIST_ID}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return FALLBACK

    const html = await res.text()
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    const json = match?.[1]
    if (!json) return FALLBACK

    const entity = (JSON.parse(json) as EmbedData).props?.pageProps?.state?.data?.entity
    const list = entity?.trackList
    if (!Array.isArray(list) || list.length === 0) return FALLBACK

    const sources = entity?.coverArt?.sources ?? []
    const embedCover = sources.length ? sources.reduce((a, b) => (b.width > a.width ? b : a)).url : null
    // prefer the real page's og:image (fresher), fall back to the embed cover
    const cover = (await fetchPlaylistCover()) ?? embedCover

    const tracks: SpotifyTrack[] = []
    for (const t of list) {
      const uri = t.uri ?? ""
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
    return tracks.length > 0 ? tracks : FALLBACK
  } catch {
    return FALLBACK
  }
}
