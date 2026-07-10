import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
