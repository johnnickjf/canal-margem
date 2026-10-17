export const normalizationVersion = 'poc-1';

export const series = [
  {
    id: 'tr4',
    indicator: 'TR4',
    source: 'ibge',
    dataset: '4099',
    variable: '4099',
    name: 'Taxa de desocupação (14 anos ou mais)',
    frequency: 'quarterly',
    temporal_basis: 'calendar_quarter',
    methodology: 'pnadc-quarterly-national-unadjusted',
  },
  {
    id: 'cv1-monthly',
    indicator: 'CV1',
    source: 'ibge',
    dataset: '1737',
    variable: '63',
    name: 'IPCA — variação mensal',
    frequency: 'monthly',
    temporal_basis: 'calendar_month',
    methodology: 'snipc-ipca-national-monthly',
  },
  {
    id: 'cv1-12m',
    indicator: 'CV1',
    source: 'ibge',
    dataset: '1737',
    variable: '2265',
    name: 'IPCA — variação acumulada em 12 meses',
    frequency: 'monthly',
    temporal_basis: 'trailing_12_months',
    methodology: 'snipc-ipca-national-12m',
  },
  {
    id: 'vf1',
    indicator: 'VF1',
    source: 'bcb',
    dataset: 'sgs',
    variable: '29265',
    name: 'Comprometimento da renda com serviço da dívida',
    frequency: 'monthly',
    temporal_basis: 'trailing_3_month_average',
    methodology: 'sgs-29265-rndbf-unadjusted',
  },
] as const;

export type SeriesId = (typeof series)[number]['id'];
export type Definition = (typeof series)[number];

export type Period = { start: string; end: string; label: string };
export type Candidate = {
  series: SeriesId;
  reference_period: Period;
  value: string | null;
  value_status: 'observed' | 'missing' | 'not_applicable' | 'suppressed';
  value_note: string | null;
  source_record_locator: string;
};

export type Window = { from: string; to: string };

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateWindow(window: Window) {
  assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(window.from), 'from deve ser YYYY-MM');
  assert(/^\d{4}-(0[1-9]|1[0-2])$/.test(window.to), 'to deve ser YYYY-MM');
  assert(
    window.from >= '2012-01' && window.from <= window.to,
    'Janela inválida; início >= 2012-01',
  );
  assert(window.to <= new Date().toISOString().slice(0, 7), 'Janela não pode terminar no futuro');
}

export function monthPeriod(year: number, month: number, label: string): Period {
  assert(year >= 1900 && year <= 9999 && month >= 1 && month <= 12, 'Período inválido');
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start, end, label };
}

export function inWindow(period: Period, window: Window) {
  return period.start >= `${window.from}-01` && period.end.slice(0, 7) <= window.to;
}

export function requests(window: Window) {
  validateWindow(window);
  const ibge = 'https://servicodados.ibge.gov.br/api/v3/agregados';
  const months: string[] = [];
  const quarters = new Set<string>();
  for (let year = Number(window.from.slice(0, 4)); year <= Number(window.to.slice(0, 4)); year++) {
    for (let month = 1; month <= 12; month++) {
      const period = monthPeriod(year, month, '');
      if (inWindow(period, window)) months.push(`${year}${String(month).padStart(2, '0')}`);
    }
    for (let quarter = 1; quarter <= 4; quarter++) {
      const period = monthPeriod(year, quarter * 3 - 2, '');
      period.end = monthPeriod(year, quarter * 3, '').end;
      if (inWindow(period, window)) quarters.add(`${year}0${quarter}`);
    }
  }
  assert(quarters.size > 0, 'Janela deve conter ao menos um trimestre civil completo');
  const end = monthPeriod(Number(window.to.slice(0, 4)), Number(window.to.slice(5)), '').end;
  const br = (date: string) => date.split('-').reverse().join('/');
  return [
    { id: 'tr4-metadata', url: `${ibge}/4099/metadados` },
    { id: 'cv1-metadata', url: `${ibge}/1737/metadados` },
    {
      id: 'tr4',
      url: `${ibge}/4099/periodos/${[...quarters].join('|')}/variaveis/4099?localidades=N1[1]`,
    },
    {
      id: 'cv1',
      url: `${ibge}/1737/periodos/${months.join('|')}/variaveis/63|2265?localidades=N1[1]`,
    },
    {
      id: 'vf1',
      url: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.29265/dados?formato=json&dataInicial=${br(`${window.from}-01`)}&dataFinal=${br(end)}`,
    },
  ];
}
