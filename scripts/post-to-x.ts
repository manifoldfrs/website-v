#!/usr/bin/env node
/**
 * Post newly published blog posts to X. Run by .github/workflows/post-to-x.yml after a push
 * that adds files under src/content/posts/.
 *
 * Waits until each post's page is live on heyfar.is (Cloudflare deploys separately from
 * GitHub, so the page can lag the push), then posts "<title> <url>" with OAuth 1.0a user
 * tokens. Those don't expire, unlike OAuth 2.0 user tokens, so they suit CI.
 *
 * Run:  node scripts/post-to-x.ts src/content/posts/independence.md [...]
 * Env:  X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
 *       DRY_RUN=1 prints the post instead of sending it
 */

import { createHmac, randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
import { basename } from "node:path"
import { setTimeout } from "node:timers/promises"
import matter from "gray-matter"
import { deriveSlugFromFilename } from "../src/lib/blog/slug.ts"

const SITE_URL = "https://heyfar.is"
const POST_ENDPOINT = "https://api.x.com/2/tweets"
const LIVE_TIMEOUT_MS = 20 * 60 * 1000
const LIVE_POLL_MS = 15 * 1000

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error("✗ Usage: node scripts/post-to-x.ts <post.md> [...]")
  process.exit(1)
}

const posts = files
  .map((file) => ({ file, data: matter(readFileSync(file, "utf8")).data }))
  .filter(({ data }) => process.env.GITHUB_EVENT_NAME !== "push" || data.announceOnX !== false)

if (posts.length === 0) {
  console.log("No posts to announce.")
  process.exit(0)
}

const dryRun = process.env.DRY_RUN === "1"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`✗ Missing ${name}`)
    process.exit(1)
  }
  return value
}

const credentials = dryRun
  ? null
  : {
      consumerKey: requireEnv("X_CONSUMER_KEY"),
      consumerSecret: requireEnv("X_CONSUMER_SECRET"),
      accessToken: requireEnv("X_ACCESS_TOKEN"),
      accessTokenSecret: requireEnv("X_ACCESS_TOKEN_SECRET"),
    }

// RFC 3986 encoding, which OAuth 1.0a signatures require; encodeURIComponent leaves !'()* alone.
function oauthEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function oauthHeader(method: string, url: string, creds: NonNullable<typeof credentials>): string {
  const params: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  }

  // JSON bodies are not part of the signature base string; only the oauth_* params are.
  const paramString = Object.keys(params)
    .sort()
    .map((key) => `${oauthEncode(key)}=${oauthEncode(params[key] ?? "")}`)
    .join("&")
  const baseString = [method, oauthEncode(url), oauthEncode(paramString)].join("&")
  const signingKey = `${oauthEncode(creds.consumerSecret)}&${oauthEncode(creds.accessTokenSecret)}`
  params.oauth_signature = createHmac("sha1", signingKey).update(baseString).digest("base64")

  return (
    "OAuth " +
    Object.keys(params)
      .sort()
      .map((key) => `${oauthEncode(key)}="${oauthEncode(params[key] ?? "")}"`)
      .join(", ")
  )
}

async function waitUntilLive(url: string): Promise<void> {
  const deadline = Date.now() + LIVE_TIMEOUT_MS
  while (Date.now() < deadline) {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" })
    if (res.ok) return
    console.log(`… ${url} returned ${res.status}, retrying in ${LIVE_POLL_MS / 1000}s`)
    await setTimeout(LIVE_POLL_MS)
  }
  throw new Error(`${url} was not live after ${LIVE_TIMEOUT_MS / 60000} minutes`)
}

async function postToX(text: string, creds: NonNullable<typeof credentials>): Promise<string> {
  const res = await fetch(POST_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: oauthHeader("POST", POST_ENDPOINT, creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  })
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`X API returned ${res.status}: ${body}`)
  }
  const id: unknown = JSON.parse(body)?.data?.id
  if (typeof id !== "string") {
    throw new Error(`X API response had no post id: ${body}`)
  }
  return id
}

let failed = false

for (const { file, data } of posts) {
  const title: unknown = data.title
  if (typeof title !== "string" || title.length === 0) {
    console.error(`✗ ${file} has no title in its frontmatter`)
    failed = true
    continue
  }

  const url = `${SITE_URL}/blog/${deriveSlugFromFilename(basename(file))}`
  const text = `${title} ${url}`

  if (dryRun || !credentials) {
    console.log(`[dry run] ${text}`)
    continue
  }

  try {
    await waitUntilLive(url)
    const id = await postToX(text, credentials)
    console.log(`✓ Posted ${file}: https://x.com/i/status/${id}`)
  } catch (error) {
    console.error(`✗ ${file}: ${error instanceof Error ? error.message : String(error)}`)
    failed = true
  }
}

if (failed) process.exit(1)
