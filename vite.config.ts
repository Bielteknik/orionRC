// FIX: Import 'process' to provide types for 'process.cwd()'
import process from 'process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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
        // FIX: Use env.API_KEY as per the coding guidelines to source the API key.
        'process.env.API_KEY': JSON.stringify(env.API_KEY),
      },
      build: {
        rollupOptions: {
          external: ['xlsx']
        }
      }
    };
});