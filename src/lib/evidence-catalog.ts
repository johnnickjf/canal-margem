import { z } from 'astro/zod';
import type { PolicyCatalog } from './policy-catalog';

const text = z.string().trim().min(1);
const id = text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const date = z.iso.date();
const interval = z.strictObject({ start: date, end: date });

export const evidenceKinds = {
  research: 'Pesquisa acadêmica',
  'impact-study': 'Estudo de impacto',
  'technical-note': 'Nota técnica',
  evaluation: 'Avaliação',
  methodology: 'Metodologia',
} as const;

export const evidenceClasses = {
  descriptive: 'Análise descritiva ou contábil',
  'causal-estimate': 'Estimativa causal condicionada',
  methodological: 'Referência metodológica',
} as const;

const assessment = z.discriminatedUnion('classification', [
  z.strictObject({ classification: z.literal('descriptive'), rationale: text }),
  z.strictObject({
    classification: z.literal('causal-estimate'),
    rationale: text,
    counterfactual: text,
    assumptions: z.array(text).min(1),
  }),
  z.strictObject({ classification: z.literal('methodological'), rationale: text }),
]);

export const evidenceCatalogSchema = z.strictObject({
  version: z.literal('1'),
  revision: text,
  author: text,
  reviewed_at: date,
  scope: text,
  studies: z
    .array(
      z.strictObject({
        id,
        title: text,
        authors: z.array(text).min(1),
        year: z.number().int().min(1900).max(9999),
        publisher: text,
        kind: z.enum(['research', 'impact-study', 'technical-note', 'evaluation', 'methodology']),
        publication_status: z.enum(['working-paper', 'peer-reviewed', 'institutional']),
        question: text,
        geography: text,
        population: text,
        period: interval.nullable(),
        method: text,
        assessment,
        finding: text,
        limitations: z.array(text).min(1),
        sources: z
          .array(
            z.strictObject({ label: text, url: z.url({ protocol: /^https$/ }), locator: text }),
          )
          .min(1),
        policies: z
          .array(
            z.strictObject({
              policy: id,
              applicability: z.enum(['same-policy', 'historical-program', 'methodological']),
              note: text,
            }),
          )
          .min(1),
        indicators: z.array(z.strictObject({ indicator: id, outcome: text, note: text })),
      }),
    )
    .min(1),
});

export type EvidenceCatalog = z.infer<typeof evidenceCatalogSchema>;
export type Study = EvidenceCatalog['studies'][number];

/** Editorial assessment is explicit, never inferred from a chart or a study title. */
export function validateEvidenceCatalog(
  input: unknown,
  policies: PolicyCatalog,
  indicators: string[],
): EvidenceCatalog {
  const catalog = evidenceCatalogSchema.parse(input);
  function unique(values: string[]) {
    if (new Set(values).size !== values.length)
      throw new Error('Referência duplicada nas evidências.');
  }
  unique(catalog.studies.map((study) => study.id));
  for (const study of catalog.studies) {
    const studyPeriod = study.period;
    if (study.year > Number(catalog.reviewed_at.slice(0, 4)))
      throw new Error('Estudo posterior à revisão.');
    const methodological = study.assessment.classification === 'methodological';
    if (
      methodological !== (study.kind === 'methodology') ||
      methodological !== (study.period === null)
    ) {
      throw new Error('Metodologia e período incompatíveis.');
    }
    if (
      study.period &&
      (study.period.end < study.period.start || Number(study.period.end.slice(0, 4)) > study.year)
    ) {
      throw new Error('Período do estudo inválido.');
    }
    if (!methodological && study.indicators.length === 0)
      throw new Error('Estudo sem desfecho relacionado.');
    unique(study.policies.map((relation) => relation.policy));
    unique(study.indicators.map((relation) => relation.indicator));
    for (const relation of study.policies) {
      const policy = policies.policies.find((item) => item.id === relation.policy);
      if (!policy) throw new Error('Política da evidência ausente.');
      if (methodological !== (relation.applicability === 'methodological'))
        throw new Error('Aplicabilidade incompatível.');
      if (
        relation.applicability === 'same-policy' &&
        studyPeriod &&
        !policy.effective_periods.some(
          (period) =>
            period.start <= studyPeriod.end &&
            (period.end === null || period.end >= studyPeriod.start),
        )
      )
        throw new Error('Estudo anterior ou externo à vigência: explicite o programa histórico.');
    }
    for (const relation of study.indicators) {
      if (!indicators.includes(relation.indicator))
        throw new Error('Indicador da evidência ausente.');
    }
  }
  return catalog;
}

export function relatedStudies(catalog: EvidenceCatalog, kind: 'policy' | 'indicator', id: string) {
  return catalog.studies.filter((study) =>
    kind === 'policy'
      ? study.policies.some((relation) => relation.policy === id)
      : study.indicators.some((relation) => relation.indicator === id),
  );
}
