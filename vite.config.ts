import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    appType: 'mpa', // отключает SPA fallback
    build: {
        rollupOptions: {
            input: {
                index: 'index.html',
                accounts: resolve(__dirname, 'accounts/new/index.html'),
                // history: 'history.html', // или 'history/index.html'
            },
        },
    },
    server: {
        // чтобы в dev удобно открывать нужную страницу (не обязательно)
        open: 'index.html',
    },
});