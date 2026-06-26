import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://reparo-app.netlify.app"
  const heute = new Date()

  return [
    {
      url: baseUrl,
      lastModified: heute,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: heute,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/registrierung`,
      lastModified: heute,
      changeFrequency: "yearly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/impressum`,
      lastModified: heute,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/datenschutz`,
      lastModified: heute,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/agb`,
      lastModified: heute,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
