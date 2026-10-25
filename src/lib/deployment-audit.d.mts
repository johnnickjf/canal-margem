export type PublicHtmlAudit = {
  issues: string[];
  title: string | null;
  canonicalHref: string | null;
};

export function inspectPublicHtml(
  html: string,
  pageUrl: string | URL,
  xRobotsTag?: string | null,
): PublicHtmlAudit;
export function parseSitemapLocations(xml: string): string[];
export function parseRobotsSitemaps(robotsText: string): string[];
export function parseRobotsGroups(
  robotsText: string,
): { agents: string[]; rules: { directive: string; path: string }[] }[];
export function robotsAllows(
  groups: { agents: string[]; rules: { directive: string; path: string }[] }[],
  url: URL,
): boolean;
export function resolveSameOriginUrl(value: string, origin: string | URL): URL | null;
