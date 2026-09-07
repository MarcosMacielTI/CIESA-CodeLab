import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@ciesa/config': fileURLToPath(new URL('../../packages/config/src/index.ts', import.meta.url)),
            '@ciesa/contracts': fileURLToPath(new URL('../../packages/contracts/src/index.ts', import.meta.url))
        }
    },
    test: {
        setupFiles: [fileURLToPath(new URL('./src/test-setup.ts', import.meta.url))]
    }
});
