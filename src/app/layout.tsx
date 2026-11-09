/// <reference types="react/experimental" />
import type { ReactNode } from "react"
import { ViewTransition } from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Footer } from "@/components/footer"
import { SiteNavigation } from "@/components/site-navigation"
import { Turntable } from "@/components/turntable"
import "./globals.css"
import "./turntable.css"

export const metadata: Metadata = {
  title: "Faris Habib",
  description: "Faris' personal website",
  metadataBase: new URL("https://heyfar.is"),
  openGraph: {
    title: "Faris Habib",
    url: "https://heyfar.is",
    siteName: "Faris Habib",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Faris Habib" },
}

export const viewport: Viewport = { themeColor: "#0c0c0d" }

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <div className="site-shell">
          <SiteNavigation />
          <main id="main-content" className="site-main">
            <ViewTransition>{children}</ViewTransition>
          </main>
          <Footer />
        </div>
        <Turntable />
        <Analytics />
      </body>
    </html>
  )
}
