import {
  assert,
  type Candidate,
  type Definition,
  inWindow,
  monthPeriod,
  type Window,
} from './catalog.ts';

function object(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value), 'Objeto esperado');
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  assert(Array.isArray(value), 'Array esperado');
  return value;
}

function decimal(
  raw: unknown,
  definition: Definition,
): Pick<Candidate, 'value' | 'value_status' | 'value_note'> {
  assert(typeof raw === 'string', 'Valor deve ser texto decimal');
  const symbols = { '...': 'missing', '..': 'not_applicable', X: 'suppressed' } as const;
  if (definition.source === 'ibge' && Object.hasOwn(symbols, raw)) {
    return {
      value: null,
      value_status: symbols[raw as keyof typeof symbols],
      value_note: `Símbolo SIDRA: ${raw}`,
    };
  }
  const text = raw === '-' && definition.source === 'ibge' ? '0' : raw;
  assert(/^-?\d+(\.\d+)?$/.test(text) && Number.isFinite(Number(text)), 'Decimal inválido');
  if (definition.id === 'tr4' || definition.id === 'vf1') {
    assert(Number(text) >= 0 && Number(text) <= 100, 'Taxa fora de 0–100');
  } else {
    assert(Number(text) >= -100, 'Inflação abaixo de -100%');
  }
  // Canonicalização textual, sem arredondar pelo ponto flutuante.
  const [integer, fraction] = text.split('.');
  let value = integer.replace(/^(-?)0+(?=\d)/, '$1');
  const decimals = fraction?.replace(/0+$/, '');
  if (decimals) value += `.${decimals}`;
  if (/^-0$/.test(value)) value = '0';
  return {
    value,
    value_status: 'observed',
    value_note: raw === '-' ? 'Zero absoluto (SIDRA)' : null,
  };
}

export function normalizeIbge(
  data: unknown,
  metadata: unknown,
  definitions: readonly Definition[],
  window: Window,
): Candidate[] {
  const meta = object(metadata);
  assert(String(meta.id) === definitions[0].dataset, 'Tabela de metadados divergente');
  assert(
    object(meta.periodicidade).frequencia ===
      (definitions[0].frequency === 'quarterly' ? 'trimestral' : 'mensal'),
    'Frequência divergente',
  );
  const variables = array(data);
  assert(variables.length === definitions.length, 'Cardinalidade de variáveis divergente');
  const candidates: Candidate[] = [];
  for (const definition of definitions) {
    const matches = variables.filter((v) => object(v).id === definition.variable);
    assert(matches.length === 1, 'Variável ausente ou duplicada');
    const variable = object(matches[0]);
    const official = array(meta.variaveis).filter(
      (v) => String(object(v).id) === definition.variable,
    );
    assert(
      official.length === 1 && object(official[0]).unidade === '%',
      'Unidade dos metadados divergente',
    );
    assert(
      variable.unidade === '%' || variable.unidade === '',
      'Unidade de observações divergente',
    );
    const results = array(variable.resultados);
    assert(results.length === 1, 'Recorte de resultados divergente');
    const result = object(results[0]);
    assert(array(result.classificacoes).length === 0, 'Classificação inesperada');
    const localities = array(result.series);
    assert(localities.length === 1, 'Geografias ausentes ou duplicadas');
    const locality = object(localities[0]);
    const geo = object(locality.localidade);
    assert(geo.id === '1' && object(geo.nivel).id === 'N1', 'Geografia deve ser Brasil N1/1');
    const entries = Object.entries(object(locality.serie));
    assert(entries.length > 0, 'Série vazia');
    for (const [code, raw] of entries) {
      assert(/^\d{6}$/.test(code), 'Código de período inválido');
      const year = Number(code.slice(0, 4));
      const part = Number(code.slice(4));
      const quarterly = definition.frequency === 'quarterly';
      assert(!quarterly || (part >= 1 && part <= 4), 'Trimestre inválido');
      const period = monthPeriod(
        year,
        quarterly ? part * 3 - 2 : part,
        quarterly ? `${year}T${part}` : `${year}-${code.slice(4)}`,
      );
      if (quarterly) period.end = monthPeriod(year, part * 3, '').end;
      assert(inWindow(period, window), 'Fonte retornou período fora da janela');
      candidates.push({
        series: definition.id,
        reference_period: period,
        ...decimal(raw, definition),
        source_record_locator: `/${variables.indexOf(matches[0])}/resultados/0/series/0/serie/${code}`,
      });
    }
  }
  return candidates;
}

export function normalizeBcb(data: unknown, definition: Definition, window: Window): Candidate[] {
  const rows = array(data);
  assert(rows.length > 0, 'Série BCB vazia');
  const seen = new Set<string>();
  let previous = '';
  return rows.map((item, index) => {
    const row = object(item);
    assert(
      typeof row.data === 'string' && /^01\/(0[1-9]|1[0-2])\/\d{4}$/.test(row.data),
      'BCB deve rotular o mês no dia 01',
    );
    const period = monthPeriod(
      Number(row.data.slice(6)),
      Number(row.data.slice(3, 5)),
      `${row.data.slice(6)}-${row.data.slice(3, 5)}`,
    );
    assert(inWindow(period, window), 'BCB retornou período fora da janela');
    assert(
      !seen.has(period.start) && period.start > previous,
      'Meses BCB duplicados ou fora de ordem',
    );
    seen.add(period.start);
    previous = period.start;
    return {
      series: definition.id,
      reference_period: period,
      ...decimal(row.valor, definition),
      source_record_locator: `/${index}`,
    };
  });
}

export function validateCoverage(
  candidates: Candidate[],
  definitions: readonly Definition[],
  window: Window,
) {
  for (const definition of definitions) {
    const periods = candidates
      .filter((item) => item.series === definition.id)
      .map((item) => item.reference_period)
      .sort((a, b) => a.start.localeCompare(b.start));
    assert(periods.length > 0, `Sem cobertura: ${definition.id}`);
    const step = definition.frequency === 'quarterly' ? 3 : 1;
    let expected = `${window.from}-01`;
    if (step === 3) {
      const month = Number(window.from.slice(5));
      expected = new Date(
        Date.UTC(Number(window.from.slice(0, 4)), Math.ceil((month - 1) / 3) * 3, 1),
      )
        .toISOString()
        .slice(0, 10);
    }
    for (const period of periods) {
      assert(
        period.start === expected,
        `Lacuna ou duplicata não declarada: ${definition.id} em ${expected}`,
      );
      const date = new Date(`${period.start}T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + step);
      expected = date.toISOString().slice(0, 10);
    }
  }
  const monthly = candidates
    .filter((item) => item.series === 'cv1-monthly')
    .map((item) => item.reference_period.start)
    .sort();
  const annual = candidates
    .filter((item) => item.series === 'cv1-12m')
    .map((item) => item.reference_period.start)
    .sort();
  assert(
    JSON.stringify(monthly) === JSON.stringify(annual),
    'Medidas de CV1 com cobertura divergente',
  );
}
