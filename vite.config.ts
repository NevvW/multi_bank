import { defineConfig } from 'vite';

export default defineConfig({
    appType: 'mpa', // отключает SPA fallback
    build: {
        rollupOptions: {
            input: {
                index: 'index.html',
                // history: 'history.html', // или 'history/index.html'
            },
        },
    },
    server: {
        // чтобы в dev удобно открывать нужную страницу (не обязательно)
        open: 'index.html',
    },
});