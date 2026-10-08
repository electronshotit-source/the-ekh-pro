import type { NextConfig } from "next"

/**
 * Deploy targets:
 *  - Vercel (default): native Next.js at the domain root.
 *  - Static hosts (GitHub Pages): set STATIC_EXPORT=1 and, for a project
 *    site, NEXT_PUBLIC_BASE_PATH=/repo-name. Everything in this app runs in
 *    the browser, so a static export loses nothing.
 */
const isStaticExport = process.env.STATIC_EXPORT === "1"
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

const nextConfig: NextConfig = {
  ...(isStaticExport && {
    output: "export",
    trailingSlash: true,
    basePath,
    images: { unoptimized: true },
  }),
  ...(!isStaticExport && {
    cacheComponents: true,
    partialPrefetching: true,
  }),
  turbopack: {
    rules: {
      "*.css": {
        // Only our own stylesheets — next/font's generated CSS must not pass
        // through Tailwind, or its internal font URLs fail to resolve in dev.
        condition: { not: "foreign" },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
