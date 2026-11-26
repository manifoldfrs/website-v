import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"

const nextConfig: NextConfig = {
  output: "export",
  agentRules: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "effect"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
}

export default function config(phase: string): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER) return nextConfig

  return {
    ...nextConfig,
    output: undefined,
    async rewrites() {
      return [{
        source: "/games/scrap-circuit/index",
        destination: "/games/scrap-circuit/index.html",
      }]
    },
  }
}
