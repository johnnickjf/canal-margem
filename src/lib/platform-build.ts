import definitions from '../../backend/internal/publications/indicators.json';

export type Indicator = (typeof definitions)[number];
export type Theme = { slug: string; name: string; question: string };
export type ObservationNode = {
  observation: {
    id: string;
    series?: string;
    start?: string;
    end?: string;
    value?: string | null;
    status: string;
    context?: {
      source?: string;
      dataset?: string;
      comparison_start?: string;
      comparison_end?: string;
      index_base_period?: string;
    };
  };
  origins: { url: string; retrieved_at: string }[];
  evaluation?: {
    request: { calculation: string; version: string; inputs: Record<string, string> };
  };
};
export type Selection = {
  series: {
    series: string;
    geography: string;
    unit: string;
    source: string;
    dataset: string;
    method: string;
  };
  latest: {
    start: string;
    end: string;
    status: string;
    reason?: string;
    node?: ObservationNode;
  };
  inputs?: ObservationNode[];
};
export type Platform = {
  publication: string | null;
  cutoff: string | null;
  api: string | null;
  themes: Theme[];
  indicators: Indicator[];
  selections: Record<string, Selection[]>;
  sources: { id: string; name: string; url: string }[];
};

const themes: Theme[] = [
  {
    slug: 'trabalho-e-renda',
    name: 'Trabalho e renda',
    question: 'O trabalho permite viver melhor?',
  },
  { slug: 'custo-de-vida', name: 'Custo de vida', question: 'Quanto custa viver no Brasil?' },
  { slug: 'vida-financeira', name: 'Vida financeira', question: 'Quanto da renda sobra?' },
  { slug: 'qualidade-de-vida', name: 'Qualidade de vida', question: 'Como vivemos?' },
  {
    slug: 'economia-e-estado',
    name: 'Economia e Estado',
    question: 'Como a economia afeta a vida material?',
  },
];

/** Capture once before route generation. A configured API failure must stop the build. */
export async function capturePlatform(
  api?: string,
  request: typeof fetch = fetch,
): Promise<Platform> {
  if (!api)
    return {
      publication: null,
      cutoff: null,
      api: null,
      themes,
      indicators: definitions,
      selections: {},
      sources: [],
    };
  const base = new URL(api);
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/'
  ) {
    throw new Error(
      'MARGEM_API_URL deve ser uma origem HTTP sem credenciais, caminho ou parâmetros.',
    );
  }
  async function get(path: string) {
    const url = new URL(`/api/v1/${path}`, base);
    let response = await request(url, {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 429) {
      const delay = response.headers.get('Retry-After');
      if (delay !== null && /^\d+$/.test(delay) && Number(delay) <= 60) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, Number(delay) * 1000));
        response = await request(url, { signal: AbortSignal.timeout(10_000) });
      }
    }
    if (!response.ok)
      throw new Error(`API Margem: HTTP ${response.status} em ${path.split('?')[0]}`);
    return response.json();
  }
  const current = await get('publications/current');
  const id = current.publication;
  if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw new Error('Publicação inválida.');
  async function pinned(path: string) {
    const body = await get(path);
    if (body.publication !== id || body.catalog_revision !== current.catalog_revision)
      throw new Error('A API trocou o contexto da publicação.');
    return body;
  }
  const { data: manifest } = await pinned(`publications/${id}`);
  const catalog = manifest.catalog;
  if (catalog.revision !== current.catalog_revision || manifest.data_cutoff !== current.data_cutoff)
    throw new Error('Manifesto e ativação divergem.');
  for (const list of [catalog.themes, catalog.indicators]) {
    if (
      !Array.isArray(list) ||
      new Set(list.map((item) => item.slug)).size !== list.length ||
      list.some((item) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug))
    )
      throw new Error('Catálogo de rotas inválido.');
  }
  if (
    catalog.indicators.some(
      (indicator: Indicator) =>
        !catalog.themes.some((theme: Theme) => theme.slug === indicator.theme),
    )
  )
    throw new Error('Tema do indicador ausente no catálogo.');
  const selections: Platform['selections'] = {};
  const nodes = new Map<string, ObservationNode>();
  function withCatalogContext(node: ObservationNode): ObservationNode {
    const spec = catalog.series?.find(
      (item: { id: string }) => item.id === node.observation.series,
    );
    if (!spec) return node;
    return {
      ...node,
      observation: {
        ...node.observation,
        context: { source: spec.source, dataset: spec.dataset, ...node.observation.context },
      },
    };
  }
  async function lineage(root: ObservationNode): Promise<ObservationNode[]> {
    const inputs: ObservationNode[] = [];
    const visited = new Set<string>();
    const active = new Set<string>();
    async function visit(node: ObservationNode, depth: number) {
      const nodeID = node.observation.id;
      if (active.has(nodeID) || depth > 32) throw new Error('Linhagem cíclica ou profunda demais.');
      if (visited.has(nodeID)) return;
      active.add(nodeID);
      for (const inputID of Object.values(node.evaluation?.request.inputs ?? {})) {
        if (!/^[a-f0-9]{64}$/.test(inputID)) throw new Error('ID de input inválido.');
        let input = nodes.get(inputID);
        if (!input) {
          const query = new URLSearchParams({ publication: id });
          const { data } = await pinned(`observations/${inputID}?${query}`);
          if (data?.observation?.id !== inputID)
            throw new Error('Observação fora da linhagem solicitada.');
          input = withCatalogContext(data as ObservationNode);
          nodes.set(inputID, input);
        }
        await visit(input, depth + 1);
      }
      active.delete(nodeID);
      visited.add(nodeID);
      if (depth > 0) inputs.push(node);
    }
    const contextualRoot = withCatalogContext(root);
    nodes.set(root.observation.id, contextualRoot);
    await visit(contextualRoot, 0);
    return inputs;
  }
  // Serial requests respect the API's concurrency limit. All pages share this result.
  for (const indicator of catalog.indicators as Indicator[]) {
    const options: Selection['series'][] = [];
    let cursor = '';
    const seen = new Set<string>();
    do {
      const query = new URLSearchParams({
        publication: id,
        limit: '200',
        ...(cursor ? { cursor } : {}),
      });
      const body = await pinned(`indicators/${indicator.slug}/series?${query}`);
      if (!Array.isArray(body.data)) throw new Error('Lista de séries inválida.');
      options.push(...body.data);
      cursor = body.next_cursor || '';
      if (cursor && seen.has(cursor)) throw new Error('Cursor repetido.');
      seen.add(cursor);
    } while (cursor);
    selections[indicator.slug] = [];
    for (const option of options) {
      const query = new URLSearchParams({
        publication: id,
        series: option.series,
        geography: option.geography,
      });
      const { data } = await pinned(`indicators/${indicator.slug}?${query}`);
      if (
        !data.latest ||
        data.series.series !== option.series ||
        data.series.geography !== option.geography
      )
        throw new Error('Resumo fora do recorte solicitado.');
      const value = data.latest.node?.observation?.value;
      if (value != null && (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/.test(value)))
        throw new Error('Valor decimal inválido.');
      data.inputs = data.latest.node ? await lineage(data.latest.node) : [];
      selections[indicator.slug].push(data);
    }
  }
  return {
    publication: id,
    cutoff: current.data_cutoff,
    api: base.origin,
    themes: catalog.themes,
    indicators: catalog.indicators,
    selections,
    sources: catalog.sources,
  };
}
