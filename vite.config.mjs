import { defineConfig, loadEnv, transformWithOxc } from 'vite';

export default defineConfig(({ mode }) => {
  // Read only the backend port. Database credentials are never exposed to React.
  const { PORT = '3000' } = loadEnv(mode, process.cwd(), 'PORT');
  return {
    plugins: [{
      name: 'jsx-in-component-js',
      enforce: 'pre',
      async transform(code, id) {
        if (/\/client\/.*\.js$/.test(id.replaceAll('\\', '/'))) {
          return transformWithOxc(code, id, { lang: 'jsx', jsx: { runtime: 'automatic' } });
        }
      },
    }],
    server: { host: '127.0.0.1', proxy: { '/api': `http://127.0.0.1:${PORT}` } },
    optimizeDeps: { rolldownOptions: { moduleTypes: { '.js': 'jsx' } } },
    build: { outDir: 'dist' },
  };
});
