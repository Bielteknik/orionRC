import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env file based on `mode` in the current working directory.
    // FIX: Cast `process` to `any` to work around a type definition issue where `process.cwd` is not found.
    const env = loadEnv(mode, (process as any).cwd(), '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // Proxy API requests to the backend server during development
          '/api': {
            target: 'http://127.0.0.1:8000', // Your Express server's address
            changeOrigin: true,
          },
          '/uploads': {
            target: 'http://127.0.0.1:8000', // Proxy image requests
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