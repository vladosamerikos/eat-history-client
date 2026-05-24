import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const appName = env.VITE_APP_NAME || 'eat-history';
    return {
        plugins: [
            react(),
            VitePWA({
                registerType: 'autoUpdate',
                strategies: 'injectManifest',
                srcDir: 'src',
                filename: 'sw.ts',
                injectRegister: 'auto',
                includeAssets: ['favicon.svg', 'favicon.png', 'apple-touch-icon.png'],
                manifest: {
                    name: appName,
                    short_name: appName,
                    description: 'Tu nutrición, tu historia.',
                    lang: 'es',
                    theme_color: '#16a34a',
                    background_color: '#ffffff',
                    display: 'standalone',
                    orientation: 'portrait',
                    start_url: '/app',
                    scope: '/',
                    icons: [
                        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                        { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                    ],
                },
                injectManifest: {
                    globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
                    globIgnores: ['**/material-symbols-*.woff2'],
                    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
                },
                devOptions: { enabled: true, type: 'module' },
            }),
        ],
        resolve: {
            alias: { '@': path.resolve(__dirname, './src') },
        },
        server: {
            host: '0.0.0.0',
            port: 5173,
            proxy: {
                '/v1': {
                    target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
    };
});
