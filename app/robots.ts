import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://reparo-app.netlify.app"
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
