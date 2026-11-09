import type { ReactNode } from "react"

const GitHubIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.1.82-.26.82-.58v-2.2c-3.34.72-4.04-1.6-4.04-1.6-.55-1.39-1.34-1.76-1.34-1.76-1.1-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.3 3.5 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.32.47-2.4 1.24-3.24-.13-.3-.54-1.52.11-3.17 0 0 1.01-.32 3.3 1.24a11.5 11.5 0 0 1 6 0c2.29-1.56 3.3-1.24 3.3-1.24.65 1.65.24 2.87.12 3.17.77.84 1.23 1.92 1.23 3.24 0 4.62-2.8 5.64-5.48 5.94.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
  </svg>
)

const XIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.9 1.2h3.7l-8 9.2 9.4 12.4h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9 6.1-6.9Zm-1.3 19.5h2L6.5 3.3H4.4l13.2 17.4Z" />
  </svg>
)

const LinkedInIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.8 0 0 .78 0 1.74v20.51C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.75V1.74C24 .78 23.2 0 22.22 0Z" />
  </svg>
)

const socialLinks: { label: string; href: string; icon: ReactNode }[] = [
  { label: "GitHub", href: "https://github.com/manifoldfrs", icon: GitHubIcon },
  { label: "X", href: "https://x.com/frshbb", icon: XIcon },
  { label: "LinkedIn", href: "https://linkedin.com/in/farishabib", icon: LinkedInIcon },
]

/** GitHub, X and LinkedIn as icon links, shared by the footer and the homepage turntable. */
export function SocialLinks() {
  return socialLinks.map((link) => (
    <a
      key={link.label}
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={link.label}
      data-cursor-hover
    >
      {link.icon}
    </a>
  ))
}

/** Copyright and social links, without contact or music controls. */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-content">
        <p>
          © {new Date().getFullYear()} Faris Habib. All Rights Reserved.
        </p>
        <div className="social-links">
          <SocialLinks />
        </div>
      </div>
    </footer>
  )
}
