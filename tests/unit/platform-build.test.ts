import { describe, expect, it, vi } from 'vitest';
import { capturePlatform } from '../../src/lib/platform-build';

const id = 'a'.repeat(64);
const cutoff = '2026-10-18T12:00:00Z';
const theme = { slug: 'trabalho-e-renda', name: 'Trabalho e renda', question: 'Pergunta?' };
const indicator = { id: 'tr4', slug: 'desemprego', theme: theme.slug, role: 'primary' };
const option = { series: 'tr4', geography: 'BR', unit: '%' };
const historyPath = '/api/v1/series/tr4';
function fixture(change: (path: string, body: Record<string, unknown>) => void = () => {}) {
  let latest: Record<string, unknown>;
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input));
    const path = url.pathname;
    const body: Record<string, unknown> = { publication: id, catalog_revision: 'catalog' };
    if (path.endsWith('/current')) body.data_cutoff = cutoff;
    else if (path.includes('/publications/'))
      body.data = {
        data_cutoff: cutoff,
        catalog: { revision: 'catalog', themes: [theme], indicators: [indicator], sources: [] },
      };
    else if (path === historyPath) body.data = [{ ...latest, series: 'tr4', geography: 'BR' }];
    else {
      expect(url.searchParams.get('publication')).toBe(id);
      if (path.endsWith('/series')) body.data = [option];
      else
        body.data = {
          series: option,
          latest: {
            start: '2025-01-01',
            end: '2025-03-31',
            status: 'observed',
            node: {
              observation: { value: '0.000000000000000001', status: 'observed' },
              origins: [],
            },
          },
        };
    }
    change(path, body);
    if (path.endsWith('/desemprego'))
      latest = (body.data as { latest: Record<string, unknown> }).latest;
    return Response.json(body);
  });
}

describe('captura da publicação para HTML estático', () => {
  it('sem API entrega catálogo e nenhuma observação', async () => {
    const request = fixture();
    const data = await capturePlatform(undefined, request);
    expect(data.publication).toBeNull();
    expect(data.themes).toHaveLength(5);
    expect(data.indicators.filter((item) => item.role === 'primary')).toHaveLength(15);
    expect(data.selections).toEqual({});
    expect(request).not.toHaveBeenCalled();
  });
  it('resolve o alias uma vez, fixa as consultas e preserva decimal sem float', async () => {
    const request = fixture();
    const data = await capturePlatform('http://api.test', request);
    expect(request.mock.calls.filter(([input]) => String(input).endsWith('/current'))).toHaveLength(
      1,
    );
    expect(data.selections.desemprego[0].latest.node?.observation.value).toBe(
      '0.000000000000000001',
    );
  });
  it('não substitui o último período ausente por um valor', async () => {
    const request = fixture((path, body) => {
      if (path.endsWith('/desemprego'))
        body.data = {
          series: option,
          latest: {
            start: '2025-04-01',
            end: '2025-06-30',
            status: 'pending_recalculation',
            reason: 'Input revisado',
          },
        };
    });
    const data = await capturePlatform('http://api.test', request);
    expect(data.selections.desemprego[0].latest.status).toBe('pending_recalculation');
    expect(data.selections.desemprego[0].latest.node).toBeUndefined();
  });
  it('percorre opções paginadas mantendo o cursor e publicação', async () => {
    let page = 0;
    const request = fixture((path, body) => {
      if (path.endsWith('/series')) {
        if (page++ === 0) body.next_cursor = 'opaque';
        else body.data = [];
      }
    });
    await capturePlatform('http://api.test', request);
    expect(
      request.mock.calls.some(
        ([input]) => new URL(String(input)).searchParams.get('cursor') === 'opaque',
      ),
    ).toBe(true);
  });
  it('rejeita cursor cíclico', async () => {
    await expect(
      capturePlatform(
        'http://api.test',
        fixture((path, body) => {
          if (path.endsWith('/series')) body.next_cursor = 'repeated';
        }),
      ),
    ).rejects.toThrow('Cursor repetido');
  });
  it('interrompe o build se o contexto muda', async () => {
    await expect(
      capturePlatform(
        'http://api.test',
        fixture((path, body) => {
          if (!path.endsWith('/current')) body.publication = 'b'.repeat(64);
        }),
      ),
    ).rejects.toThrow('contexto');
  });
  it('interrompe o build quando a API configurada falha', async () => {
    await expect(
      capturePlatform(
        'http://api.test',
        vi.fn(async () => new Response('', { status: 503 })),
      ),
    ).rejects.toThrow('HTTP 503');
  });
  it('respeita Retry-After uma vez sem resolver outra publicação', async () => {
    const success = fixture();
    let limited = false;
    const request = vi.fn<typeof fetch>(async (input, init) => {
      if (!limited && String(input).includes('/desemprego/series')) {
        limited = true;
        return new Response('', { status: 429, headers: { 'Retry-After': '0' } });
      }
      return success(input, init);
    });
    expect((await capturePlatform('http://api.test', request)).publication).toBe(id);
    expect(success.mock.calls.filter(([input]) => String(input).endsWith('/current'))).toHaveLength(
      1,
    );
  });
  it('rejeita número JSON em lugar de decimal string', async () => {
    const request = fixture((path, body) => {
      if (path.endsWith('/desemprego'))
        body.data = { series: option, latest: { node: { observation: { value: 7.1 } } } };
    });
    await expect(capturePlatform('http://api.test', request)).rejects.toThrow('decimal');
  });
  it('rejeita credenciais e caminhos na origem', async () => {
    await expect(capturePlatform('http://user:password@api.test')).rejects.toThrow('origem HTTP');
    await expect(capturePlatform('http://api.test/api')).rejects.toThrow('origem HTTP');
  });
});

describe('linhagem de cálculos derivados', () => {
  const rootID = '1'.repeat(64);
  const derivedID = '2'.repeat(64);
  const sourceID = '3'.repeat(64);
  const source = {
    observation: { id: sourceID, series: 'tr4', status: 'observed' },
    origins: [{ url: 'https://ibge.gov.br/dados', retrieved_at: cutoff }],
  };
  const derived = {
    observation: { id: derivedID, status: 'observed' },
    origins: [],
    evaluation: { request: { calculation: 'rebase', version: '2', inputs: { base: sourceID } } },
  };
  function derivedFixture(
    change: (path: string, body: Record<string, unknown>) => void = () => {},
  ) {
    return fixture((path, body) => {
      if (path.endsWith('/desemprego')) {
        body.data = {
          series: option,
          latest: {
            start: '2025-01-01',
            end: '2025-03-31',
            status: 'observed',
            node: {
              observation: { id: rootID, value: '1.25', status: 'observed' },
              origins: [],
              evaluation: {
                request: {
                  calculation: 'relative-change',
                  version: '2',
                  inputs: { current: derivedID, previous: sourceID },
                },
              },
            },
          },
        };
      }
      if (path.endsWith(`/observations/${derivedID}`)) body.data = derived;
      if (path.endsWith(`/observations/${sourceID}`)) body.data = source;
      change(path, body);
    });
  }
  it('resolve inputs transitivos na mesma publicação e reutiliza observações compartilhadas', async () => {
    const request = derivedFixture();
    const data = await capturePlatform('http://api.test', request);
    expect(data.selections.desemprego[0].inputs).toEqual([source, derived]);
    const requests = request.mock.calls.filter(([input]) =>
      String(input).includes('/observations/'),
    );
    expect(requests).toHaveLength(2);
    for (const [input] of requests)
      expect(new URL(String(input)).searchParams.get('publication')).toBe(id);
  });
  it('identifica fonte e dataset pelo catálogo fixado quando o input não os repete', async () => {
    const request = derivedFixture((path, body) => {
      if (path.includes('/publications/') && !path.endsWith('/current')) {
        const manifest = body.data as { catalog: { series?: unknown[] } };
        manifest.catalog.series = [{ id: 'tr4', source: 'ibge', dataset: 'pnadc' }];
      }
    });
    const data = await capturePlatform('http://api.test', request);
    expect(data.selections.desemprego[0].inputs?.[0].observation.context).toEqual({
      source: 'ibge',
      dataset: 'pnadc',
    });
  });
  it('rejeita contexto divergente em uma observação de entrada', async () => {
    await expect(
      capturePlatform(
        'http://api.test',
        derivedFixture((path, body) => {
          if (path.includes('/observations/')) body.publication = 'b'.repeat(64);
        }),
      ),
    ).rejects.toThrow('contexto');
  });
  it('rejeita resposta de outro input', async () => {
    await expect(
      capturePlatform(
        'http://api.test',
        derivedFixture((path, body) => {
          if (path.endsWith(`/observations/${sourceID}`)) body.data = derived;
        }),
      ),
    ).rejects.toThrow('fora da linhagem');
  });
  it('interrompe a captura quando a linhagem contém um ciclo', async () => {
    await expect(
      capturePlatform(
        'http://api.test',
        derivedFixture((path, body) => {
          if (path.endsWith(`/observations/${sourceID}`))
            body.data = {
              ...source,
              evaluation: {
                request: { calculation: 'rebase', version: '2', inputs: { base: rootID } },
              },
            };
        }),
      ),
    ).rejects.toThrow('cíclica');
  });
});

describe('histórico paginado e fixado', () => {
  it('carrega todas as páginas e mantém os períodos ausentes', async () => {
    let page = 0;
    const request = fixture((path, body) => {
      if (path === historyPath && page++ === 0) {
        body.data = [
          {
            series: 'tr4',
            geography: 'BR',
            start: '2024-01-01',
            end: '2024-03-31',
            status: 'missing',
            reason: 'Sem cobertura',
          },
        ];
        body.next_cursor = 'second-history-page';
      }
    });
    const data = await capturePlatform('http://api.test', request);
    expect(data.selections.desemprego[0].history).toHaveLength(2);
    expect(data.selections.desemprego[0].history?.[0].status).toBe('missing');
    expect(
      request.mock.calls.some(([input]) => String(input).includes('cursor=second-history-page')),
    ).toBe(true);
  });
  for (const [name, mutate, message] of [
    [
      'geografia divergente',
      (point: Record<string, unknown>) => {
        point.geography = 'São Paulo';
      },
      'fora do recorte',
    ],
    [
      'série divergente',
      (point: Record<string, unknown>) => {
        point.series = 'cv4';
      },
      'fora do recorte',
    ],
    [
      'data inexistente',
      (point: Record<string, unknown>) => {
        point.start = '2025-02-30';
      },
      'período inválido',
    ],
    [
      'período invertido',
      (point: Record<string, unknown>) => {
        point.start = '2025-04-01';
      },
      'período inválido',
    ],
    [
      'resumo divergente',
      (point: Record<string, unknown>) => {
        point.end = '2025-04-01';
      },
      'divergem',
    ],
    [
      'observado sem número',
      (point: Record<string, unknown>) => {
        point.node = undefined;
      },
      'fora do recorte',
    ],
    [
      'número float',
      (point: Record<string, unknown>) => {
        point.node = { observation: { value: 7.1 } };
      },
      'decimal',
    ],
  ] as const) {
    it(`interrompe build com ${name}`, async () => {
      await expect(
        capturePlatform(
          'http://api.test',
          fixture((path, body) => {
            if (path === historyPath) mutate((body.data as Record<string, unknown>[])[0]);
          }),
        ),
      ).rejects.toThrow(message);
    });
  }
  it('rejeita período duplicado e histórico vazio', async () => {
    for (const empty of [false, true]) {
      await expect(
        capturePlatform(
          'http://api.test',
          fixture((path, body) => {
            if (path === historyPath) {
              const rows = body.data as unknown[];
              body.data = empty ? [] : [...rows, ...rows];
            }
          }),
        ),
      ).rejects.toThrow(empty ? 'divergem' : 'período inválido');
    }
  });
  it('rejeita cursor repetido no histórico', async () => {
    await expect(
      capturePlatform(
        'http://api.test',
        fixture((path, body) => {
          if (path === historyPath) {
            body.data = [];
            body.next_cursor = 'loop';
          }
        }),
      ),
    ).rejects.toThrow('Cursor repetido no histórico');
  });
  it('rejeita troca de edição no histórico', async () => {
    await expect(
      capturePlatform(
        'http://api.test',
        fixture((path, body) => {
          if (path === historyPath) body.publication = 'b'.repeat(64);
        }),
      ),
    ).rejects.toThrow('contexto');
  });
});

describe('tempo de trabalho da publicação', () => {
  function workTimeFixture(change: (data: Record<string, unknown>) => void = () => {}) {
    const series = { ...option, series: 'cv4', geography: 'BR-city-3550308' };
    const latest = {
      start: '2025-01-01',
      end: '2025-01-31',
      status: 'observed',
      node: { observation: { id: 'f'.repeat(64), value: '750', status: 'observed' }, origins: [] },
    };
    const request = fixture((path, body) => {
      if (path.endsWith('/desemprego/series')) body.data = [series];
      if (path.endsWith('/desemprego')) body.data = { series, latest };
      if (path === '/api/v1/series/cv4')
        body.data = [{ ...latest, series: series.series, geography: series.geography }];
      if (path === '/api/v1/work-time') {
        const translation: Record<string, unknown> = {
          series: series.series,
          geography: series.geography,
          from: latest.start,
          to: latest.end,
          status: 'not_computed',
          reason: 'reference_not_covered',
        };
        change(translation);
        body.data = translation;
      }
    });
    return request;
  }
  it('fixa publicação e mês sem substituir renda ausente por um valor', async () => {
    const request = workTimeFixture();
    const data = await capturePlatform('http://api.test', request);
    expect(data.selections.desemprego[0].workTime?.reason).toBe('reference_not_covered');
    const call = request.mock.calls.find(([input]) => String(input).includes('/work-time?'));
    const url = new URL(String(call?.[0]));
    expect(url.searchParams.get('publication')).toBe(id);
    expect(url.searchParams.get('from')).toBe('2025-01-01');
    expect(url.searchParams.get('to')).toBe('2025-01-31');
  });
  function computedTranslation(data: Record<string, unknown>) {
    const price = {
      series: 'cv4',
      geography: 'BR-city-3550308',
      start: '2025-01-01',
      end: '2025-01-31',
      status: 'observed',
      node: {
        observation: {
          id: 'f'.repeat(64),
          start: '2025-01-01',
          end: '2025-01-31',
          value: '750',
          status: 'observed',
        },
        origins: [],
      },
    };
    const income = {
      ...price,
      series: 'minimum-nominal',
      geography: 'BR',
      node: {
        ...price.node,
        observation: { ...price.node.observation, id: '8'.repeat(64), value: '1500' },
      },
    };
    const evaluation = (calculation: string, value: string) => ({
      request: {
        calculation,
        version: '1',
        inputs: { basket: price.node.observation.id, nominal: income.node.observation.id },
      },
      output: { value },
    });
    Object.assign(data, {
      status: 'computed',
      reason: undefined,
      price,
      income,
      hours: evaluation('cv5', '110'),
      share: evaluation('price-income', '50'),
      rounded_minutes: '6600',
    });
  }
  it('preserva os decimais e os IDs de uma conversão calculada pela API', async () => {
    const data = await capturePlatform('http://api.test', workTimeFixture(computedTranslation));
    expect(data.selections.desemprego[0].workTime?.hours?.output.value).toBe('110');
    expect(data.selections.desemprego[0].workTime?.income?.node?.observation.id).toBe(
      '8'.repeat(64),
    );
  });
  type MutableTranslation = {
    income: { start: string };
    hours: { request: { inputs: { nominal: string } }; output: { value: unknown } };
    rounded_minutes: unknown;
  };
  for (const mutate of [
    (data: MutableTranslation) => {
      data.income.start = '2024-12-01';
    },
    (data: MutableTranslation) => {
      data.hours.request.inputs.nominal = '9'.repeat(64);
    },
    (data: MutableTranslation) => {
      data.rounded_minutes = 6600;
    },
    (data: MutableTranslation) => {
      data.hours.output.value = 110;
    },
  ]) {
    it('rejeita mês, IDs ou tipos decimais incompatíveis com a conversão', async () => {
      await expect(
        capturePlatform(
          'http://api.test',
          workTimeFixture((data) => {
            computedTranslation(data);
            mutate(data as Parameters<typeof mutate>[0]);
          }),
        ),
      ).rejects.toThrow('referências válidas');
    });
  }
  it('interrompe build quando a conversão é de outro recorte', async () => {
    await expect(
      capturePlatform(
        'http://api.test',
        workTimeFixture((data) => {
          data.geography = 'BR';
        }),
      ),
    ).rejects.toThrow('fora do recorte');
  });
  it('rejeita conversão declarada calculada sem números e referências', async () => {
    await expect(
      capturePlatform(
        'http://api.test',
        workTimeFixture((data) => {
          data.status = 'computed';
        }),
      ),
    ).rejects.toThrow('referências válidas');
  });
});
