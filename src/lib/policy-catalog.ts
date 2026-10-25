import { z } from 'astro/zod';

const text = z.string().trim().min(1);
const id = text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const date = z.iso.date();
const source = z.strictObject({ label: text, url: z.url({ protocol: /^https$/ }) });
const interval = { start: date, end: date.nullable() };
const legalReference = z.strictObject({ legislation: id, locator: text });

/** Editorial context, deliberately independent of immutable numerical publications. */
export const policyCatalogSchema = z.strictObject({
  version: z.literal('1'),
  revision: text,
  reviewed_at: date,
  author: text,
  scope: text,
  legislation: z
    .array(
      z.strictObject({
        id,
        name: text,
        enacted_at: date,
        published_at: date,
        sources: z.array(source).min(1),
      }),
    )
    .min(1),
  governments: z
    .array(
      z.strictObject({
        id,
        name: text,
        office: text,
        geography: z.literal('BR'),
        ...interval,
        note: text,
        sources: z.array(source).min(1),
      }),
    )
    .min(1),
  policies: z
    .array(
      z.strictObject({
        id,
        name: text,
        description: text,
        geography: z.literal('BR'),
        limitations: text,
        legal_references: z.array(legalReference).min(1),
        effective_periods: z
          .array(
            z.strictObject({
              id,
              ...interval,
              scope: text,
              references: z.array(legalReference).min(1),
            }),
          )
          .min(1),
        affected_indicators: z
          .array(
            z.strictObject({
              indicator: id,
              relationship: z.literal('contextual'),
              note: text,
            }),
          )
          .min(1),
        government_periods: z.array(z.strictObject({ government: id, note: text })).min(1),
      }),
    )
    .min(1),
});

export type PolicyCatalog = z.infer<typeof policyCatalogSchema>;
export type Policy = PolicyCatalog['policies'][number];
export type Legislation = PolicyCatalog['legislation'][number];
export type Government = PolicyCatalog['governments'][number];
export type EffectivePeriod = Policy['effective_periods'][number];
export type AffectedIndicators = Policy['affected_indicators'];

/** Reject broken references before any page or machine-readable catalog is generated. */
export function validatePolicyCatalog(input: unknown, indicators: string[]): PolicyCatalog {
  const catalog = policyCatalogSchema.parse(input);
  function unique(values: string[]) {
    if (new Set(values).size !== values.length)
      throw new Error('ID repetido no catálogo de políticas.');
  }
  const laws = new Set(catalog.legislation.map((item) => item.id));
  const governments = new Set(catalog.governments.map((item) => item.id));
  for (const list of [catalog.legislation, catalog.governments, catalog.policies]) {
    unique(list.map((item) => item.id));
  }
  function validInterval(period: { start: string; end: string | null }) {
    if (period.end !== null && period.end < period.start) throw new Error('Intervalo invertido.');
  }
  for (const law of catalog.legislation) {
    if (law.published_at < law.enacted_at) throw new Error('Publicação anterior à promulgação.');
  }
  for (const government of catalog.governments) validInterval(government);
  for (const policy of catalog.policies) {
    const referenced = new Set(policy.legal_references.map((item) => item.legislation));
    for (const reference of policy.legal_references) {
      if (!laws.has(reference.legislation)) throw new Error('Legislação ausente.');
    }
    unique(policy.effective_periods.map((item) => item.id));
    unique(policy.affected_indicators.map((item) => item.indicator));
    unique(policy.government_periods.map((item) => item.government));
    for (const period of policy.effective_periods) {
      validInterval(period);
      for (const reference of period.references) {
        if (!referenced.has(reference.legislation))
          throw new Error('Vigência sem legislação da política.');
      }
    }
    for (const relation of policy.affected_indicators) {
      if (!indicators.includes(relation.indicator))
        throw new Error('Indicador da política ausente no catálogo.');
    }
    for (const context of policy.government_periods) {
      if (!governments.has(context.government)) throw new Error('Governo ausente.');
    }
  }
  return catalog;
}

/** Both ends are inclusive civil dates. Null means no documented end, not today. */
export function overlaps(start: string, end: string | null, from: string, to: string) {
  return start <= to && (end === null || end >= from);
}

/** Same date projection as the numerical chart; coordinates never alter indicator values. */
export function timelineX(date: string, from: string, to: string) {
  if (from === to) return 340;
  return 30 + ((Date.parse(date) - Date.parse(from)) / (Date.parse(to) - Date.parse(from))) * 620;
}

export function policyTimeline(
  catalog: PolicyCatalog,
  indicator: string,
  from: string,
  to: string,
) {
  const rows = catalog.policies.flatMap((policy) =>
    policy.affected_indicators.some((item) => item.indicator === indicator)
      ? policy.effective_periods
          .filter((period) => overlaps(period.start, period.end, from, to))
          .map((period) => ({
            kind: 'policy' as 'policy' | 'government',
            id: `${policy.id}-${period.id}`,
            policy: policy.id,
            label: `${policy.name} · ${period.scope}`,
            start: period.start,
            end: period.end,
          }))
      : [],
  );
  if (rows.length === 0) return [];
  // All catalogued governments in the visible window, including successors of the
  // implementation government. Temporal context never implies exclusive authorship.
  rows.push(
    ...catalog.governments
      .filter((item) => overlaps(item.start, item.end, from, to))
      .map((item) => ({
        kind: 'government' as const,
        id: item.id,
        policy: '',
        label: item.name,
        start: item.start,
        end: item.end,
      })),
  );
  return rows.map((row) => {
    const start = row.start < from ? from : row.start;
    const end = row.end === null || row.end > to ? to : row.end;
    return { ...row, x1: timelineX(start, from, to), x2: timelineX(end, from, to) };
  });
}
