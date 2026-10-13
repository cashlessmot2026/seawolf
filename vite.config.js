import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages sirve el sitio en /seawolf/. Para otro hosting: VITE_BASE=/ npm run build
const base = process.env.VITE_BASE || '/seawolf/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'img/logo.png'],
      manifest: {
        name: 'Seawolf SAI · Reservas',
        short_name: 'Seawolf',
        description: 'Alojamientos, embarcaciones y vehículos en San Andrés isla.',
        lang: 'es',
        theme_color: '#0b2e2b',
        background_color: '#0b2e2b',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Las llamadas a Supabase siempre van a la red: reservas y QR deben estar al día
        runtimeCaching: [
          { urlPattern: /supabase\.co/, handler: 'NetworkOnly' }
        ]
      }
    })
  ]
})
