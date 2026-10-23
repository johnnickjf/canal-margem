import type { HistoryPoint, Indicator, Platform, Selection, Theme } from './platform-build';

export type ComparisonCatalog = {
  api: string | null;
  publication: string | null;
  themes: Theme[];
  indicators: (Indicator & { selections: Selection['series'][] })[];
  starts: string[];
  ends: string[];
};

export function comparisonCatalog(platform: Platform): ComparisonCatalog {
  const indicators = platform.indicators
    .filter((indicator) => indicator.role === 'primary')
    .map((indicator) => ({
      ...indicator,
      selections: (platform.selections[indicator.slug] ?? []).map((item) => item.series),
    }));
  const history = indicators.flatMap((indicator) =>
    (platform.selections[indicator.slug] ?? []).flatMap((selection) => selection.history ?? []),
  );
  return {
    api: platform.api,
    publication: platform.publication,
    themes: platform.themes,
    indicators,
    starts: [...new Set(history.map((point) => point.start))].sort(),
    ends: [...new Set(history.map((point) => point.end))].sort(),
  };
}

export const assessmentLabels = {
  improved: 'Melhorou nesta medida',
  worsened: 'Piorou nesta medida',
  stable: 'Estável nesta medida',
  insufficient_data: 'Sem dados suficientes',
  context_required: 'Exige contexto para avaliar',
} as const;

export const reasonLabels: Record<string, string> = {
  endpoint_not_covered: 'Um dos extremos selecionados não tem cobertura nesta publicação.',
  endpoint_unavailable: 'Um dos períodos está indisponível ou aguarda recálculo.',
  ambiguous_endpoints: 'Há mais de um período no extremo selecionado; o recorte é ambíguo.',
  not_comparable: 'Os períodos, unidades, bases ou métodos são incompatíveis.',
  nonpositive_denominator:
    'A variação percentual exige um valor inicial maior que zero. Tente a diferença absoluta.',
};

export type ComparisonQuery = {
  series: string;
  geography: string;
  from: string;
  to: string;
  calculation: 'difference' | 'relative-change';
};
export type ComparisonResult = {
  from: string;
  to: string;
  calculation: ComparisonQuery['calculation'];
  version: string;
  status: 'computed' | 'not_comparable';
  value: string | null;
  reason?: string;
  previous?: HistoryPoint;
  current?: HistoryPoint;
  assessment: {
    version: string;
    status: keyof typeof assessmentLabels;
    direction: 'up' | 'down' | 'flat' | 'unavailable';
    rule: string;
  };
  evaluation?: {
    definition: { formula: string; methodology: string; precision: number; rounding: string };
    request: { calculation: string; version: string; inputs: Record<string, string> };
    output: { value: string; context: { unit: string } };
    warnings: string[];
  };
};

export function comparisonURL(catalog: ComparisonCatalog, query: ComparisonQuery): string {
  if (!catalog.api || !catalog.publication) throw new Error('Publicação indisponível.');
  return `${catalog.api}/api/v1/comparisons?${new URLSearchParams({
    ...query,
    publication: catalog.publication,
    version: '2',
    assessment: 'material-v1',
  })}`;
}

/** Only the backend evaluates numbers and interpretation. Never resolve the live alias. */
export async function fetchComparison(
  catalog: ComparisonCatalog,
  query: ComparisonQuery,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<ComparisonResult> {
  let response: Response;
  try {
    response = await request(comparisonURL(catalog, query), {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      credentials: 'omit',
    });
  } catch (error) {
    if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) throw error;
    throw new Error(
      'Não foi possível acessar a comparação. Verifique sua conexão e tente novamente.',
    );
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      410: 'Esta publicação não está mais disponível. Atualize a página para obter a edição atual.',
      429: 'Limite de consultas atingido. Aguarde um minuto e tente novamente.',
      503: 'A comparação está temporariamente indisponível. Tente novamente.',
    };
    throw new Error(
      messages[response.status] ??
        `Não foi possível comparar (HTTP ${response.status}). Tente novamente.`,
    );
  }
  const body = await response.json().catch(() => {
    throw new Error('A comparação recebeu uma resposta inválida. Tente novamente.');
  });
  const data: ComparisonResult = body?.data;
  const decimal = (value: unknown) => typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value);
  const pointMatches = (point: HistoryPoint | undefined, boundary: 'start' | 'end', date: string) =>
    point?.series === query.series &&
    point?.geography === query.geography &&
    point[boundary] === date;
  if (
    body?.publication !== catalog.publication ||
    !data ||
    data.from !== query.from ||
    data.to !== query.to ||
    data.calculation !== query.calculation ||
    data.version !== '2' ||
    !['computed', 'not_comparable'].includes(data.status) ||
    data.assessment?.version !== 'material-v1' ||
    !Object.hasOwn(assessmentLabels, data.assessment?.status ?? '') ||
    typeof data.assessment.rule !== 'string' ||
    !['up', 'down', 'flat', 'unavailable'].includes(data.assessment.direction) ||
    (data.previous && !pointMatches(data.previous, 'start', query.from)) ||
    (data.current && !pointMatches(data.current, 'end', query.to)) ||
    (data.status === 'not_comparable' &&
      (data.value !== null || data.assessment.status !== 'insufficient_data')) ||
    (data.status === 'computed' &&
      (!decimal(data.value) ||
        !pointMatches(data.previous, 'start', query.from) ||
        !pointMatches(data.current, 'end', query.to) ||
        data.previous?.status !== 'observed' ||
        data.current?.status !== 'observed' ||
        !decimal(data.previous?.node?.observation?.value) ||
        !decimal(data.current?.node?.observation?.value) ||
        !/^[a-f0-9]{64}$/.test(data.previous?.node?.observation?.id ?? '') ||
        !/^[a-f0-9]{64}$/.test(data.current?.node?.observation?.id ?? '') ||
        data.evaluation?.output?.value !== data.value ||
        typeof data.evaluation?.output?.context?.unit !== 'string' ||
        typeof data.evaluation?.definition?.formula !== 'string' ||
        typeof data.evaluation?.definition?.methodology !== 'string' ||
        data.evaluation?.request?.calculation !== query.calculation ||
        data.evaluation.request.version !== '2' ||
        data.evaluation.request.inputs?.previous !== data.previous?.node?.observation.id ||
        data.evaluation.request.inputs?.current !== data.current?.node?.observation.id ||
        data.assessment.status === 'insufficient_data'))
  )
    throw new Error(
      'A resposta não corresponde à publicação ou ao recorte selecionado. Tente novamente.',
    );
  return data;
}
