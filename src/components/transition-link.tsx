"use client"

import Link from "next/link"
import type { ReactNode } from "react"

interface TransitionLinkProps {
  readonly href: `/${string}`
  readonly children: ReactNode
  readonly className?: string
  readonly ariaLabel?: string
}

/** A client-side navigation link: the page animates through React view transitions and the turntable keeps playing. */
export function TransitionLink({ href, children, className, ariaLabel }: TransitionLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      data-cursor-hover
    >
      {children}
    </Link>
  )
}
