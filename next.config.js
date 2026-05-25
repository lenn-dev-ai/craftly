/** @type {import('next').NextConfig} */
const nextConfig = {
  // Sprint AG — Mapbox/react-map-gl als ESM-only Module zur
  // Webpack-Transpile-Liste hinzufügen, sonst kippt der Netlify-
  // Production-Build mit "Cannot use import statement outside a module".
  transpilePackages: ['react-map-gl', 'mapbox-gl'],
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
