// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Domínio definitivo: atualize também `site.url` em src/config/site.ts.
export default defineConfig({
  site: 'https://margem.com.br',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  image: {
    domains: ['images.unsplash.com'],
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
});
