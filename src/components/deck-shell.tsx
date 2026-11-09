"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

const ENGINE_URL = "/vinyl/src/main.js"
let engineRequested = false

/** Loads the record player the first time the homepage is shown; it then keeps running across client navigations. */
function startEngine() {
  if (engineRequested) return
  engineRequested = true
  import(/* webpackIgnore: true */ /* turbopackIgnore: true */ ENGINE_URL).catch(() => {
    engineRequested = false
    console.error("[turntable] Could not load the record player engine")
  })
}

/**
 * Wraps the turntable, which lives in the root layout so the music survives navigation.
 * On the homepage it is the whole page; elsewhere only the now-playing pill shows (see turntable.css).
 */
export function DeckShell({ children }: { readonly children: ReactNode }) {
  const isHome = usePathname() === "/"

  useEffect(() => {
    if (isHome) startEngine()
  }, [isHome])

  return (
    <div className="deck" data-home={isHome ? "" : undefined}>
      {children}
    </div>
  )
}
