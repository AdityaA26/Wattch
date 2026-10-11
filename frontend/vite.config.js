import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // Browser calls are same-origin with Vite. The backend receives a
        // server-to-server request rather than a forwarded browser Origin.
        configure: proxy => proxy.on('proxyReq', request => request.removeHeader('origin')),
      }
    }
  }
});
