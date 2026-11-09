"use client"

import { usePathname } from "next/navigation"
import { TransitionLink } from "@/components/transition-link"

const links = [
  { href: "/", label: "[home]" },
  { href: "/about", label: "[about]" },
  { href: "/blog", label: "[writing]" },
] as const

/** Whether the visitor is on this link's page or inside its section, e.g. a post under /blog. */
function isWithin(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The intentionally small primary navigation shared by every page: links to every section but the current one. */
export function SiteNavigation() {
  const pathname = usePathname()

  return (
    <header className="site-header">
      <nav aria-label="Main">
        {links.flatMap(({ href, label }) =>
          isWithin(pathname, href) ? [] : [<TransitionLink key={href} href={href}>{label}</TransitionLink>],
        )}
      </nav>
    </header>
  )
}
