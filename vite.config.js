import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // 'autoUpdate' reloads the page once a new service worker takes over. That
    // is the right trade for a wall-mounted screen nobody interacts with: a
    // deploy reaches the TV on its own instead of waiting for the next reboot.
    // The cost is that a deploy mid-session interrupts whatever is on screen,
    // including an in-progress game, so deploy deliberately.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        // The firebase chunk alone is ~700 kB, over Workbox's 2 MiB default
        // once the games chunk and CSS are included.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'NooK Family Display',
        short_name: 'NooK',
        description: 'NooK family wall display',
        theme_color: '#0D1822',
        background_color: '#0D1822',
        display: 'fullscreen',
        orientation: 'landscape',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/favicon.svg',  sizes: 'any',     type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'games': [
            './src/components/games/FamilyFeud.jsx',
            './src/components/games/Jeopardy.jsx',
            './src/components/games/Tetris.jsx',
            './src/components/games/Trivia.jsx',
            './src/components/games/TriviaShowdown.jsx',
            './src/components/games/HeadsUp.jsx',
            './src/components/games/WouldYouRather.jsx',
            './src/components/games/DailyRiddles.jsx',
          ]
        }
      }
    }
  }
})
