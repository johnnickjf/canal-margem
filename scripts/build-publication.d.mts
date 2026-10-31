export function buildPublication(options: {
  api: string;
  outputRoot: string;
  request?: typeof fetch;
  build: (site: string, origin: string) => Promise<void>;
}): Promise<{ generation: number; publication: string; directory: string; site: string }>;
