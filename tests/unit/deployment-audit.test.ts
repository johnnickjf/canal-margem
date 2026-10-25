import { describe, expect, it } from 'vitest';
import {
  inspectPublicHtml,
  parseRobotsGroups,
  parseRobotsSitemaps,
  parseSitemapLocations,
  resolveSameOriginUrl,
  robotsAllows,
} from '../../src/lib/deployment-audit.mjs';

const validPage = `
  <html><head>
    <title>Auditoria &amp; transparência | MARGEM</title>
    <meta name="description" content="Acompanhe os dados publicados.">
    <meta property="og:title" content="Auditoria &amp; transparência | MARGEM">
    <meta property="og:description" content="Acompanhe os dados publicados.">
    <meta property="og:url" content="https://margem.com.br/auditoria/">
    <meta property="og:image" content="https://margem.com.br/social.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Auditoria &amp; transparência | MARGEM">
    <meta name="twitter:description" content="Acompanhe os dados publicados.">
    <link rel="canonical" href="https://margem.com.br/auditoria/">
    <script type="application/ld+json">{"@type":"WebPage"}</script>
  </head><body><main><h1>Auditoria e transparência</h1><p>Conteúdo público.</p></main></body></html>
`;

describe('deployment audit helpers', () => {
  it('accepts accessible, indexable HTML with page metadata and valid JSON-LD', () => {
    expect(inspectPublicHtml(validPage, 'https://margem.com.br/auditoria')).toEqual({
      issues: [],
      title: 'Auditoria & transparência | MARGEM',
      canonicalHref: 'https://margem.com.br/auditoria/',
    });
  });

  it('reports missing metadata, multiple headings, noindex, and invalid JSON-LD', () => {
    const html = validPage
      .replace('<meta name="description" content="Acompanhe os dados publicados.">', '')
      .replace('</main>', '<h1>Outro título</h1></main>')
      .replace(
        '<script type="application/ld+json">{"@type":"WebPage"}</script>',
        '<script type="application/ld+json">{</script>',
      )
      .replace('</head>', '<meta name="robots" content="noindex, follow"></head>');
    const result = inspectPublicHtml(html, 'https://margem.com.br/auditoria/');
    expect(result.issues).toEqual(
      expect.arrayContaining([
        'meta description ausente ou vazia',
        'a página precisa de um main e um único h1 com texto dentro dele',
        'diretiva robots=noindex em URL pública',
        'JSON-LD inválido',
      ]),
    );
  });

  it('reads escaped sitemap locations and robots sitemap directives', () => {
    expect(
      parseSitemapLocations(
        '<urlset><url><loc>https://margem.com.br/a?x=1&amp;y=2</loc></url></urlset>',
      ),
    ).toEqual(['https://margem.com.br/a?x=1&y=2']);
    expect(
      parseRobotsSitemaps(
        '# index\nUser-agent: *\nSitemap: https://margem.com.br/sitemap-index.xml\n',
      ),
    ).toEqual(['https://margem.com.br/sitemap-index.xml']);
  });

  it('combines repeated wildcard robots groups and applies the most specific rule', () => {
    const groups = parseRobotsGroups(
      'User-agent: *\nDisallow: /\nUser-agent: *\nDisallow: /dados\nAllow: /dados/publicos\n',
    );
    expect(robotsAllows(groups, new URL('https://margem.com.br/indicador/cesta-basica/'))).toBe(
      false,
    );
    expect(robotsAllows(groups, new URL('https://margem.com.br/dados/publicos/serie.json'))).toBe(
      true,
    );
    expect(robotsAllows(groups, new URL('https://margem.com.br/dados/privado/raw.json'))).toBe(
      false,
    );
  });

  it('accepts same-origin sitemap URLs and rejects external, credentialed, or query URLs', () => {
    expect(resolveSameOriginUrl('/indicador/cesta-basica/', 'https://margem.com.br')?.href).toBe(
      'https://margem.com.br/indicador/cesta-basica/',
    );
    expect(resolveSameOriginUrl('https://example.com/page', 'https://margem.com.br')).toBeNull();
    expect(
      resolveSameOriginUrl('https://user:secret@margem.com.br/', 'https://margem.com.br'),
    ).toBeNull();
    expect(
      resolveSameOriginUrl('https://margem.com.br/?preview=1', 'https://margem.com.br'),
    ).toBeNull();
  });
});
