// Controlled HTTP fixture for the static build; never used by the application.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const indicators = JSON.parse(
  readFileSync(new URL('../../backend/internal/publications/indicators.json', import.meta.url)),
);
const publication = 'a'.repeat(64);
const revision = 'c'.repeat(64);
const cutoff = '2026-10-18T12:00:00Z';
const themes = [
  ['trabalho-e-renda', 'Trabalho e renda', 'O trabalho permite viver melhor?'],
  ['custo-de-vida', 'Custo de vida', 'Quanto custa viver no Brasil?'],
  ['vida-financeira', 'Vida financeira', 'Quanto da renda sobra?'],
  ['qualidade-de-vida', 'Qualidade de vida', 'Como vivemos?'],
  ['economia-e-estado', 'Economia e Estado', 'Como a economia afeta a vida material?'],
].map(([slug, name, question]) => ({ slug, name, question }));
let resolutions = 0;
const records = new Map();
const inputNode = (id, start, end, value) => ({
  observation: {
    id,
    series: 'tr4',
    start,
    end,
    value,
    status: 'observed',
    context: {},
  },
  origins: [{ url: 'https://www.ibge.gov.br/dados-desemprego', retrieved_at: cutoff }],
});
const currentInput = inputNode('d'.repeat(64), '2025-01-01', '2025-03-31', '0.000000000000000001');
const previousInput = inputNode('e'.repeat(64), '2024-01-01', '2024-03-31', '0.000000000000000002');
const server = createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  const path = url.pathname;
  let body;
  if (path === '/api/v1/publications/current') {
    // A second alias resolution would mix editions and must never happen.
    body = {
      publication: resolutions++ === 0 ? publication : 'b'.repeat(64),
      catalog_revision: revision,
      data_cutoff: cutoff,
    };
  } else if (path === `/api/v1/publications/${publication}`) {
    body = {
      publication,
      catalog_revision: revision,
      data: {
        data_cutoff: cutoff,
        catalog: {
          revision,
          themes,
          indicators,
          series: [{ id: 'tr4', source: 'ibge', dataset: 'fixture' }],
          sources: [{ id: 'ibge', name: 'IBGE', url: 'https://www.ibge.gov.br/' }],
        },
      },
    };
  } else if (url.searchParams.get('publication') === publication) {
    const indicator = indicators.find(
      (item) =>
        path === `/api/v1/indicators/${item.slug}` ||
        path === `/api/v1/indicators/${item.slug}/series`,
    );
    if (indicator) {
      const covered = ['desemprego', 'inflacao', 'cesta-basica'].includes(indicator.slug);
      const series = {
        series: indicator.slug === 'desemprego' ? 'tr4' : 'cv1-monthly',
        geography: 'BR',
        unit: '%',
        source: 'ibge',
        dataset: 'fixture',
        method: 'fixture-v1',
        frequency: 'quarterly',
        temporal_basis: 'calendar',
        warnings: ['Não emendar métodos ou recortes automaticamente.'],
      };
      const latest =
        indicator.slug === 'desemprego'
          ? {
              start: '2025-01-01',
              end: '2025-03-31',
              status: 'observed',
              node: currentInput,
            }
          : {
              start: '2025-12-01',
              end: '2025-12-31',
              status: 'pending_recalculation',
              reason: 'Input revisado',
            };
      body = {
        publication,
        catalog_revision: revision,
        data: path.endsWith('/series') ? (covered ? [series] : []) : { indicator, series, latest },
      };
      if (indicator.slug === 'cesta-basica') {
        const options = ['São Paulo', 'Recife'].map((geography) => ({
          ...series,
          series: 'cv4',
          geography,
          unit: 'R$/cesta',
        }));
        body.data = path.endsWith('/series')
          ? options
          : {
              indicator,
              series: options.find(
                (option) => option.geography === url.searchParams.get('geography'),
              ),
              latest: {
                start: '2025-12-01',
                end: '2025-12-31',
                status: 'observed',
                node: {
                  ...currentInput,
                  observation: {
                    ...currentInput.observation,
                    id: 'f'.repeat(64),
                    series: 'cv4',
                    start: '2025-12-01',
                    end: '2025-12-31',
                    value: '800.123456789012',
                  },
                },
              },
            };
      }
      if (indicator.slug === 'desemprego') {
        const calculations = ['relative-change', 'difference', 'rebase'];
        const choices = calculations.map((calculation, index) => ({
          ...series,
          series: `derived:${String(index + 1).repeat(64)}`,
          source: 'margem',
          dataset: 'indicator-engine',
          method: `${calculation}/2`,
          unit:
            calculation === 'rebase'
              ? 'index'
              : calculation === 'difference'
                ? 'percentage_points'
                : '%',
        }));
        if (path.endsWith('/series')) body.data = [series, ...choices];
        else {
          const index = choices.findIndex(
            (choice) => choice.series === url.searchParams.get('series'),
          );
          if (index >= 0) {
            const calculation = calculations[index];
            body.data = {
              indicator,
              series: choices[index],
              latest: {
                ...latest,
                node: {
                  observation: {
                    ...currentInput.observation,
                    id: String(index + 1).repeat(64),
                    series: choices[index].series,
                    value:
                      calculation === 'relative-change'
                        ? '-50'
                        : calculation === 'difference'
                          ? '-0.000000000000000001'
                          : '50',
                    context:
                      calculation === 'rebase'
                        ? { index_base_period: '2024-01-01/2024-03-31' }
                        : { comparison_start: '2024-01-01', comparison_end: '2024-03-31' },
                  },
                  origins: [],
                  evaluation: {
                    definition: {
                      formula:
                        calculation === 'difference'
                          ? 'current - previous'
                          : calculation === 'rebase'
                            ? 'current / base * 100'
                            : '(current / previous - 1) * 100',
                      methodology:
                        'Comparação de períodos compatíveis; sem classificação de bem-estar.',
                    },
                    request: {
                      calculation,
                      version: '2',
                      inputs: {
                        current: 'd'.repeat(64),
                        [calculation === 'rebase' ? 'base' : 'previous']: 'e'.repeat(64),
                      },
                    },
                  },
                },
              },
            };
          }
        }
      }
    }
    if (indicator && !path.endsWith('/series')) {
      const { series, latest } = body.data;
      const point = { ...latest, series: series.series, geography: series.geography };
      records.set(`${series.series}/${series.geography}`, point);
    }
    if (path.startsWith('/api/v1/series/')) {
      const series = decodeURIComponent(path.slice('/api/v1/series/'.length));
      const point = records.get(`${series}/${url.searchParams.get('geography')}`);
      let data = point ? [point] : [];
      let next_cursor;
      if (series === 'cv1-monthly') {
        data.unshift({
          ...point,
          start: '2025-11-01',
          end: '2025-11-30',
          status: 'observed',
          reason: undefined,
          node: {
            ...currentInput,
            observation: {
              ...currentInput.observation,
              id: '9'.repeat(64),
              series,
              start: '2025-11-01',
              end: '2025-11-30',
              value: '0.18',
            },
          },
        });
      }
      if (series === 'tr4') {
        if (!url.searchParams.has('cursor')) {
          data = [
            {
              ...point,
              start: previousInput.observation.start,
              end: previousInput.observation.end,
              node: previousInput,
            },
            {
              ...point,
              start: '2024-04-01',
              end: '2024-06-30',
              status: 'missing',
              reason: 'Sem observação na edição',
              node: undefined,
            },
          ];
          next_cursor = 'history-page-2';
        }
      }
      body = { publication, catalog_revision: revision, data, next_cursor };
    }
    if (
      path === `/api/v1/observations/${'d'.repeat(64)}` ||
      path === `/api/v1/observations/${'e'.repeat(64)}`
    )
      body = {
        publication,
        catalog_revision: revision,
        data: path.endsWith('d'.repeat(64)) ? currentInput : previousInput,
      };
  }
  response.writeHead(body ? 200 : 400, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body ?? { error: { code: 'invalid_request' } }));
});
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`http://127.0.0.1:${server.address().port}\n`);
});
