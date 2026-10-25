// @ts-check

import { mkdir, writeFile } from 'node:fs/promises';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import evidenceData from './src/data/evidence.json' with { type: 'json' };
import policyData from './src/data/policies.json' with { type: 'json' };
import { validateEvidenceCatalog } from './src/lib/evidence-catalog';
import { capturePlatform } from './src/lib/platform-build';
import { validatePolicyCatalog } from './src/lib/policy-catalog';

// Domínio definitivo: atualize também `site.url` em src/config/site.ts.
export default defineConfig({
  site: 'https://margem.com.br',
  trailingSlash: 'ignore',
  integrations: [
    {
      name: 'margem-publication',
      hooks: {
        'astro:config:setup': async ({ command }) => {
          if (command !== 'build' && command !== 'dev') return;
          const snapshot = await capturePlatform(process.env.MARGEM_API_URL);
          const policies = validatePolicyCatalog(
            policyData,
            snapshot.indicators.map((item) => item.slug),
          );
          validateEvidenceCatalog(
            evidenceData,
            policies,
            snapshot.indicators.map((item) => item.slug),
          );
          await mkdir(new URL('./.astro/', import.meta.url), { recursive: true });
          await writeFile(
            new URL('./.astro/margem-publication.json', import.meta.url),
            JSON.stringify(snapshot),
          );
        },
      },
    },
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
