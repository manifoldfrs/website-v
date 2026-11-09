"use client"

import { usePathname } from "next/navigation"
import { TransitionLink } from "@/components/transition-link"

const links = [
  { href: "/", label: "[home]" },
  { href: "/about", label: "[about]" },
  { href: "/blog", label: "[writing]" },
] as const

/** The intentionally small primary navigation shared by every page: links to every page but the current one. */
export function SiteNavigation() {
  const pathname = usePathname()

  return (
    <header className="site-header">
      <nav aria-label="Main">
        {links.flatMap(({ href, label }) =>
          href === pathname ? [] : [<TransitionLink key={href} href={href}>{label}</TransitionLink>],
        )}
      </nav>
    </header>
  )
}
