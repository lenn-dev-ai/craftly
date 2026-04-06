/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Reparo - Intelligente Immobilienverwaltung'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #FAF8F5 0%, #F0EDE8 100%)',
          padding: '60px 80px',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'linear-gradient(90deg, #3D8B7A, #4A9E8C)',
          }}
        />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#3D8B7A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 700,
            }}
          >
            R
          </div>
          <span style={{ fontSize: '28px', fontWeight: 600, color: '#2D2A26' }}>Reparo</span>
        </div>

        {/* Main headline */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h1 style={{ fontSize: '64px', fontWeight: 700, color: '#2D2A26', margin: 0, lineHeight: 1.1 }}>
            Immobilien verwalten.
          </h1>
          <h1 style={{ fontSize: '64px', fontWeight: 700, color: '#3D8B7A', margin: 0, lineHeight: 1.1 }}>
            Ohne Chaos.
          </h1>
          <p style={{ fontSize: '24px', color: '#6B665E', marginTop: '20px' }}>
            Verwalter · Mieter · Handwerker — alles auf einer Plattform
          </p>
        </div>

        {/* Bottom stats */}
        <div style={{ display: 'flex', gap: '60px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, color: '#3D8B7A' }}>500+</span>
            <span style={{ fontSize: '14px', color: '#8C857B' }}>Objekte</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, color: '#3D8B7A' }}>98%</span>
            <span style={{ fontSize: '14px', color: '#8C857B' }}>Zufriedenheit</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '32px', fontWeight: 700, color: '#3D8B7A' }}>&lt;24h</span>
            <span style={{ fontSize: '14px', color: '#8C857B' }}>Reaktionszeit</span>
          </div>
          <div style={{ display: 'flex', flex: 1 }} />
          <span style={{ fontSize: '16px', color: '#8C857B' }}>reparo.app</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
