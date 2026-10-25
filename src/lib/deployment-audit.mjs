const htmlEntities = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['gt', '>'],
  ['lt', '<'],
  ['quot', '"'],
]);

function decodeEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
    if (name.startsWith('#x') || name.startsWith('#')) {
      const hexadecimal = name.startsWith('#x');
      const point = Number.parseInt(name.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      try {
        return String.fromCodePoint(point);
      } catch {
        return entity;
      }
    }
    return htmlEntities.get(name) ?? entity;
  });
}

function plainText(value) {
  return decodeEntities(
    value.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function attribute(tag, name) {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(
    tag,
  );
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3]) : null;
}

function metaContent(html, key, value) {
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (attribute(tag[0], key)?.toLowerCase() === value.toLowerCase()) {
      return attribute(tag[0], 'content');
    }
  }
  return null;
}

function sameRoute(left, right) {
  const normalizePath = (pathname) => pathname.replace(/\/+$/, '') || '/';
  return (
    left.origin === right.origin &&
    normalizePath(left.pathname) === normalizePath(right.pathname) &&
    !left.search &&
    !left.hash
  );
}

/** Return metadata and errors that can be checked in a public page's HTML response. */
export function inspectPublicHtml(html, pageUrl, xRobotsTag = null) {
  const url = new URL(pageUrl);
  const issues = [];
  const title = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)][0]?.[1];
  const description = metaContent(html, 'name', 'description');
  const openGraphTitle = metaContent(html, 'property', 'og:title');
  const openGraphDescription = metaContent(html, 'property', 'og:description');
  const openGraphUrl = metaContent(html, 'property', 'og:url');
  const openGraphImage = metaContent(html, 'property', 'og:image');
  const twitterCard = metaContent(html, 'name', 'twitter:card');
  const twitterTitle = metaContent(html, 'name', 'twitter:title');
  const twitterDescription = metaContent(html, 'name', 'twitter:description');
  const canonicalTag = [...html.matchAll(/<link\b[^>]*>/gi)].find((tag) =>
    attribute(tag[0], 'rel')?.toLowerCase().split(/\s+/).includes('canonical'),
  )?.[0];
  const canonicalHref = canonicalTag ? attribute(canonicalTag, 'href') : null;
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const mainSections = [...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main>/gi)];
  const main = mainSections[0]?.[1] ?? '';
  const mainHeadings = [...main.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];

  if (!title || !plainText(title)) issues.push('título ausente ou vazio');
  if (!description?.trim()) issues.push('meta description ausente ou vazia');
  if (!openGraphTitle?.trim()) issues.push('og:title ausente ou vazio');
  if (!openGraphDescription?.trim()) issues.push('og:description ausente ou vazia');
  if (openGraphTitle && title && plainText(openGraphTitle) !== plainText(title)) {
    issues.push('og:title não corresponde ao título da página');
  }
  if (openGraphDescription && description && openGraphDescription !== description) {
    issues.push('og:description não corresponde à descrição da página');
  }
  if (!openGraphImage?.trim()) issues.push('og:image ausente ou vazia');
  else {
    try {
      if (new URL(openGraphImage).protocol !== 'https:') issues.push('og:image precisa usar HTTPS');
    } catch {
      issues.push('og:image inválida');
    }
  }
  if (twitterCard !== 'summary_large_image') issues.push('twitter:card inválido ou ausente');
  if (!twitterTitle?.trim()) issues.push('twitter:title ausente ou vazio');
  if (!twitterDescription?.trim()) issues.push('twitter:description ausente ou vazia');
  if (!canonicalHref) {
    issues.push('URL canônica ausente');
  } else {
    try {
      if (!sameRoute(new URL(canonicalHref), url))
        issues.push('URL canônica não corresponde à página');
    } catch {
      issues.push('URL canônica inválida');
    }
  }
  if (openGraphUrl) {
    try {
      if (!sameRoute(new URL(openGraphUrl), url)) issues.push('og:url não corresponde à página');
    } catch {
      issues.push('og:url inválida');
    }
  } else {
    issues.push('og:url ausente');
  }
  if (
    headings.length !== 1 ||
    mainSections.length !== 1 ||
    mainHeadings.length !== 1 ||
    !plainText(headings[0]?.[1] ?? '')
  ) {
    issues.push('a página precisa de um main e um único h1 com texto dentro dele');
  }
  if (!plainText(main)) issues.push('conteúdo principal ausente no HTML');

  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const name = attribute(tag[0], 'name');
    if (name?.toLowerCase() === 'robots' || name?.toLowerCase() === 'googlebot') {
      const directives = (attribute(tag[0], 'content') ?? '').toLowerCase().split(/[\s,]+/);
      if (directives.includes('noindex')) issues.push(`diretiva ${name}=noindex em URL pública`);
    }
  }

  if (xRobotsTag) {
    const directives = xRobotsTag.toLowerCase().split(/[\s,;:]+/);
    if (directives.includes('noindex')) {
      issues.push('diretiva X-Robots-Tag=noindex em URL pública');
    }
  }

  for (const tag of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      JSON.parse(tag[1]);
    } catch {
      issues.push('JSON-LD inválido');
    }
  }

  return { issues, title: title ? plainText(title) : null, canonicalHref };
}

/** Read sitemap locations from sitemapindex or urlset XML documents. */
export function parseSitemapLocations(xml) {
  return [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)].map((match) =>
    decodeEntities(match[1].trim()),
  );
}

/** Extract sitemap directives from robots.txt. */
export function parseRobotsSitemaps(robotsText) {
  return robotsText
    .split(/\r?\n/)
    .map((line) => /^\s*sitemap\s*:\s*(\S+)\s*$/i.exec(line)?.[1])
    .filter(Boolean);
}

/** Parse user-agent groups and their allow/disallow rules. */
export function parseRobotsGroups(robotsText) {
  const groups = [];
  let group = null;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const agent = /^user-agent\s*:\s*(\S+)$/i.exec(line);
    if (agent) {
      if (!group || group.rules.length) {
        group = { agents: [], rules: [] };
        groups.push(group);
      }
      group.agents.push(agent[1].toLowerCase());
      continue;
    }
    const rule = /^(allow|disallow)\s*:\s*(.*)$/i.exec(line);
    if (rule && group) group.rules.push({ directive: rule[1].toLowerCase(), path: rule[2].trim() });
  }
  return groups;
}

/** Apply the most specific allow/disallow rule across matching robots groups. */
export function robotsAllows(groups, url) {
  const path = `${url.pathname}${url.search}`;
  const matching = groups
    .flatMap((group) => group.rules)
    .filter(({ path: rulePath }) => rulePath && robotsPatternMatches(rulePath, path))
    .sort(
      (left, right) =>
        robotsPatternSpecificity(right.path) - robotsPatternSpecificity(left.path) ||
        Number(right.directive === 'allow') - Number(left.directive === 'allow'),
    );
  return !matching.length || matching[0].directive === 'allow';
}

function robotsPatternMatches(pattern, path) {
  const endAnchored = pattern.endsWith('$');
  const body = endAnchored ? pattern.slice(0, -1) : pattern;
  const parts = body.split('*');
  if (!path.startsWith(parts[0])) return false;

  let position = parts[0].length;
  for (let index = 1; index < parts.length; index += 1) {
    const part = parts[index];
    if (endAnchored && index === parts.length - 1) {
      const suffixPosition = path.length - part.length;
      if (suffixPosition < position || !path.endsWith(part)) return false;
      position = path.length;
      continue;
    }

    const matchPosition = path.indexOf(part, position);
    if (matchPosition < 0) return false;
    position = matchPosition + part.length;
  }

  return !endAnchored || position === path.length;
}

function robotsPatternSpecificity(pattern) {
  const body = pattern.endsWith('$') ? pattern.slice(0, -1) : pattern;
  return body.replaceAll('*', '').length;
}

/** Resolve a public URL and reject credentials, fragments, queries and foreign hosts. */
export function resolveSameOriginUrl(value, origin) {
  try {
    const url = new URL(value, origin);
    const expectedOrigin = new URL(origin).origin;
    if (url.origin !== expectedOrigin || url.username || url.password || url.search || url.hash) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}
