import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8081';
const proxy = Object.fromEntries(
  ['/auth', '/users', '/restaurants', '/orders', '/payments'].map((path) => [
    path,
    { target: apiTarget, changeOrigin: true, secure: false },
  ]),
);

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, proxy },
  preview: { host: '0.0.0.0', port: 4173, proxy },
});
