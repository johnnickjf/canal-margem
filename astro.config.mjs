// @ts-check

import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Domínio definitivo: atualize também `site.url` em src/config/site.ts.
export default defineConfig({
  site: 'https://margem.com.br',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      // Referência utilitária com exemplos fictícios, marcada também com noindex.
      filter: (page) => new URL(page).pathname.replace(/\/$/, '') !== '/design-system',
    }),
  ],
  image: {
    domains: ['images.unsplash.com'],
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
});
