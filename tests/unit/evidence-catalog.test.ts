import { describe, expect, it } from 'vitest';
import indicators from '../../backend/internal/publications/indicators.json';
import raw from '../../src/data/evidence.json';
import { policyCatalog } from '../../src/data/policies';
import {
  evidenceKinds,
  relatedStudies,
  validateEvidenceCatalog,
} from '../../src/lib/evidence-catalog';

const slugs = indicators.map((item) => item.slug);
const validate = (data: unknown) => validateEvidenceCatalog(data, policyCatalog, slugs);

describe('evidência e causalidade', () => {
  it('distingue tipo de documento, inferência e aplicabilidade histórica', () => {
    const catalog = validate(raw);
    expect(catalog.studies.map((study) => study.assessment.classification)).toEqual([
      'descriptive',
      'causal-estimate',
      'methodological',
    ]);
    for (const study of catalog.studies.slice(0, 2)) {
      expect(study.policies[0].applicability).toBe('historical-program');
      expect(study.period && study.period.end < '2023-06-20').toBe(true);
    }
    for (const kind of Object.keys(evidenceKinds).filter((kind) => kind !== 'methodology')) {
      const data = structuredClone(raw);
      data.studies[0].kind = kind;
      expect(validate(data).studies[0].assessment.classification).toBe('descriptive');
    }
  });

  it('seleciona só vínculos explícitos e não confunde falta de estudo com efeito nulo', () => {
    const catalog = validate(raw);
    expect(relatedStudies(catalog, 'policy', 'bolsa-familia-2023')).toHaveLength(3);
    expect(
      relatedStudies(catalog, 'policy', 'reforma-trabalhista-2017').map((item) => item.kind),
    ).toEqual(['methodology']);
    expect(relatedStudies(catalog, 'indicator', 'pobreza').map((item) => item.id)).toEqual([
      'bolsa-familia-quinze-anos',
    ]);
    expect(relatedStudies(catalog, 'indicator', 'desemprego')).toEqual([]);
    expect(() => validateEvidenceCatalog(raw, policyCatalog, ['desemprego'])).toThrow(/Indicador/);
  });

  const mutations: Array<[string, (data: typeof raw) => void]> = [
    [
      'causal sem contrafactual',
      (data) => {
        Reflect.deleteProperty(data.studies[1].assessment, 'counterfactual');
      },
    ],
    [
      'causal sem hipóteses',
      (data) => {
        data.studies[1].assessment.assumptions = [];
      },
    ],
    [
      'classificação automática por título',
      (data) => {
        data.studies[0].assessment.classification = 'comprovado';
      },
    ],
    [
      'score político',
      (data) => {
        Object.assign(data.studies[0], { score: 10 });
      },
    ],
    [
      'política inexistente',
      (data) => {
        data.studies[0].policies[0].policy = 'ausente';
      },
    ],
    [
      'indicador inexistente',
      (data) => {
        data.studies[0].indicators[0].indicator = 'ausente';
      },
    ],
    [
      'estudo duplicado',
      (data) => {
        data.studies.push(data.studies[0]);
      },
    ],
    [
      'política duplicada',
      (data) => {
        data.studies[0].policies.push(data.studies[0].policies[0]);
      },
    ],
    [
      'indicador duplicado',
      (data) => {
        data.studies[0].indicators = [...data.studies[0].indicators, data.studies[0].indicators[0]];
      },
    ],
    [
      'data impossível',
      (data) => {
        data.studies[0].period = { start: '2001-02-30', end: '2017-12-31' };
      },
    ],
    [
      'período invertido',
      (data) => {
        data.studies[0].period = { start: '2018-01-01', end: '2017-12-31' };
      },
    ],
    [
      'dados posteriores à publicação',
      (data) => {
        data.studies[0].period = { start: '2001-01-01', end: '2020-12-31' };
      },
    ],
    [
      'publicação posterior à revisão',
      (data) => {
        data.studies[0].year = 2030;
      },
    ],
    [
      'pesquisa sem período',
      (data) => {
        data.studies[0].period = null;
      },
    ],
    [
      'metodologia como efeito empírico',
      (data) => {
        data.studies[2].assessment.classification = 'descriptive';
      },
    ],
    [
      'metodologia vinculada como avaliação',
      (data) => {
        data.studies[2].policies[0].applicability = 'same-policy';
      },
    ],
    [
      'estudo antigo atribuído à lei de 2023',
      (data) => {
        data.studies[0].policies[0].applicability = 'same-policy';
      },
    ],
    [
      'pesquisa sem desfecho',
      (data) => {
        data.studies[0].indicators = [];
      },
    ],
    [
      'fonte insegura',
      (data) => {
        data.studies[0].sources[0].url = 'javascript:alert(1)';
      },
    ],
    [
      'fonte sem localização',
      (data) => {
        data.studies[0].sources[0].locator = ' ';
      },
    ],
    [
      'fonte ausente',
      (data) => {
        data.studies[0].sources = [];
      },
    ],
    [
      'limites ausentes',
      (data) => {
        data.studies[0].limitations = [];
      },
    ],
    [
      'autoria ausente',
      (data) => {
        data.studies[0].authors = [];
      },
    ],
  ];
  it.each(mutations)('rejeita %s', (_, mutate) => {
    const data = structuredClone(raw);
    mutate(data);
    expect(() => validate(data)).toThrow();
  });

  it('aceita avaliação da mesma política somente com período compatível', () => {
    const data = structuredClone(raw);
    data.studies[0].year = 2025;
    data.studies[0].period = { start: '2023-06-20', end: '2024-12-31' };
    data.studies[0].policies[0].applicability = 'same-policy';
    expect(validate(data).studies[0].policies[0].applicability).toBe('same-policy');
  });
});
