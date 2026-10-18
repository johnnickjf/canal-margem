import { readFileSync } from 'node:fs';
import type { Platform } from './platform-build';

// Written by the Astro integration before any route is generated.
export const platform: Platform = JSON.parse(
  readFileSync('.astro/margem-publication.json', 'utf8'),
);

export function apiLink(path: string, parameters: Record<string, string> = {}) {
  if (!platform.api || !platform.publication) return undefined;
  const query = new URLSearchParams({ ...parameters, publication: platform.publication });
  return `${platform.api}/api/v1/${path}?${query}`;
}
