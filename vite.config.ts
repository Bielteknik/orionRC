import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Fix: Import `process` to ensure the correct Node.js global is used.
import process from 'process';

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    const env = loadEnv(mode, process.cwd(), '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // Proxy API requests to the backend server during development
          '/api': {
            target: 'http://localhost:8000', // Your Express server's address
            changeOrigin: true,
          },
          '/uploads': {
            target: 'http://localhost:8000', // Proxy image requests
            changeOrigin: true,
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      }
    };
});
