import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

/** 先输出到本地 dist，再由 scripts/sync-dist-to-res.mjs 复制到 res，避免 serve 占用 res 导致 EPERM */
const outDir = resolve(__dirname, 'dist');

function injectBuildReportPlaceholder(): Plugin {
  return {
    name: 'inject-build-report-placeholder',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (html.includes('EIDE_CALLGRAPH_INIT')) {
          return html;
        }
        return html.replace(
          '</head>',
          '  <!-- EIDE_CALLGRAPH_INIT:$BUILD_REPORT -->\n</head>',
        );
      },
    },
  };
}

export default defineConfig({
  plugins: [vue(), injectBuildReportPlaceholder()],
  base: './',
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'js/app.js',
        chunkFileNames: 'js/[name].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? '';
          if (name.endsWith('.css')) {
            return 'css/[name][extname]';
          }
          return 'assets/[name][extname]';
        },
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'chunk-vendors';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
