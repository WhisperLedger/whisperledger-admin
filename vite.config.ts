import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const cloudApiOrigin = 'https://whisperledger-api-dozavowbya-el.a.run.app';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    proxy: {
      '/api': {
        target: cloudApiOrigin,
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
