import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/registrierung", "/impressum", "/datenschutz"],
        disallow: [
          "/admin",
          "/dashboard-admin",
          "/dashboard-verwalter",
          "/dashboard-handwerker",
          "/dashboard-mieter",
          "/ticket",
          "/api",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
