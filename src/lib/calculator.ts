import capitals from '@/data/capitals.json';
import type { EvidenceCatalog } from './evidence-catalog';
import type { Platform } from './platform-build';
import type { PolicyCatalog } from './policy-catalog';

export const employmentLabels = {
  formal: 'Emprego com carteira ou serviço público',
  autonomous: 'Trabalho autônomo ou informal',
  unemployed: 'Sem trabalho remunerado',
  retired: 'Aposentadoria ou pensão',
  other: 'Outro vínculo ou prefiro não informar',
} as const;
export type Employment = keyof typeof employmentLabels;
export const priorityIndicators = {
  trabalho: {
    name: 'Trabalho e renda',
    indicators: ['desemprego', 'informalidade', 'rendimento-real', 'salario-minimo-real'],
  },
  alimentacao: {
    name: 'Alimentação e custo de vida',
    indicators: ['cesta-basica', 'tempo-por-cesta', 'inseguranca-alimentar'],
  },
  distribuicao: { name: 'Pobreza e desigualdade', indicators: ['pobreza', 'desigualdade'] },
  moradia: { name: 'Moradia e transporte', indicators: ['onus-aluguel'] },
} as const;
export type Priority = keyof typeof priorityIndicators;

/** Relevance is navigation, never an eligibility decision or an impact estimate. */
export function relatedPolicies(
  policies: PolicyCatalog,
  evidence: EvidenceCatalog,
  priorities: Priority[],
  employment: Employment,
) {
  const indicators = new Set<string>(
    priorities.flatMap((key) => [...priorityIndicators[key].indicators]),
  );
  return policies.policies
    .filter(
      (policy) =>
        policy.affected_indicators.some((item) => indicators.has(item.indicator)) ||
        (employment === 'retired' && policy.id === 'reforma-previdenciaria-2019'),
    )
    .map((policy) => ({
      policy,
      reasons: [
        ...priorities
          .filter((key) =>
            policy.affected_indicators.some((item) =>
              (priorityIndicators[key].indicators as readonly string[]).includes(item.indicator),
            ),
          )
          .map((key) => `Prioridade declarada: ${priorityIndicators[key].name}.`),
        ...(employment === 'retired' && policy.id === 'reforma-previdenciaria-2019'
          ? [
              'Vínculo declarado: aposentadoria ou pensão; regimes e transições precisam ser conferidos.',
            ]
          : []),
      ],
      studies: evidence.studies.filter(
        (study) =>
          study.assessment.classification !== 'methodological' &&
          study.policies.some((relation) => relation.policy === policy.id),
      ),
    }));
}

export function calculatorCatalog(platform: Platform) {
  return {
    api: platform.api,
    publication: platform.publication,
    references: (platform.selections['cesta-basica'] ?? [])
      .filter((selection) => selection.series.series === 'cv4')
      .map((selection) => ({
        geography: selection.series.geography,
        name:
          capitals[selection.series.geography as keyof typeof capitals] ??
          selection.series.geography,
        months: [
          ...new Set(
            (selection.history ?? [selection.latest]).map((point) => point.start.slice(0, 7)),
          ),
        ].sort(),
      })),
  };
}
export type CalculatorCatalog = ReturnType<typeof calculatorCatalog>;
export type Profile = {
  income: string;
  members: number;
  housing: string;
  transport: string;
  other: string;
  income_change: string;
  labor_income?: string;
  monthly_hours?: string;
};
export type CalculatorRequest = {
  publication: string;
  version: 'profile-v1';
  geography: string;
  month: string;
  profile: Profile;
};
type Budget = {
  income: string;
  per_person: string;
  expenses: string;
  remaining: string;
  expense_share: string | null;
};
export type CalculatorResult = {
  version: 'profile-v1';
  precision: number;
  rounding: string;
  geography: string;
  month: string;
  baseline: Budget;
  scenario: Budget;
  basket_share: string | null;
  basket_hours: string | null;
  reference_status: 'observed' | 'not_computed';
  reference_reason?: string;
  price?: {
    series: string;
    geography: string;
    start: string;
    end: string;
    status: string;
    node?: {
      observation: { id: string; value: string };
      origins: { url: string; retrieved_at: string }[];
    };
  };
  formulas: Record<string, string>;
};
const decimal = (value: unknown) => typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value);
export async function fetchCalculator(
  api: string,
  input: CalculatorRequest,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<CalculatorResult> {
  const response = await request(`${api}/api/v1/calculator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
    body: JSON.stringify(input),
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'Revise os valores: use reais com até duas casas decimais; renda do cenário não pode ser negativa. Renda individual e horas devem ser informadas juntas.',
      410: 'Esta publicação foi retirada. Atualize a página.',
      429: 'Limite de consultas atingido. Aguarde um minuto.',
      503: 'Calculadora temporariamente indisponível. Tente novamente.',
    };
    throw new Error(
      messages[response.status] ??
        `Não foi possível calcular (HTTP ${response.status}). Tente novamente.`,
    );
  }
  const body = await response.json();
  const data: CalculatorResult = body?.data;
  const budgetValid = (budget: Budget) =>
    budget &&
    ['income', 'per_person', 'expenses', 'remaining'].every((key) =>
      decimal(budget[key as keyof Budget]),
    ) &&
    (budget.expense_share === null || decimal(budget.expense_share));
  if (
    body.publication !== input.publication ||
    !data ||
    data.version !== input.version ||
    data.geography !== input.geography ||
    data.month !== input.month ||
    data.precision !== 12 ||
    data.rounding !== 'half_even' ||
    !budgetValid(data.baseline) ||
    !budgetValid(data.scenario) ||
    !['observed', 'not_computed'].includes(data.reference_status) ||
    !data.formulas ||
    !Object.values(data.formulas).every((value) => typeof value === 'string') ||
    !Object.keys(data.formulas).length ||
    [data.basket_share, data.basket_hours].some((value) => value !== null && !decimal(value)) ||
    (data.reference_status === 'not_computed' &&
      (data.basket_share !== null || data.basket_hours !== null)) ||
    (data.reference_status === 'observed' &&
      (data.price?.series !== 'cv4' ||
        data.price.geography !== input.geography ||
        data.price.start !== `${input.month}-01` ||
        data.price.end?.slice(0, 7) !== input.month ||
        data.price.status !== 'observed' ||
        !/^[a-f0-9]{64}$/.test(data.price.node?.observation.id ?? '') ||
        !decimal(data.price.node?.observation.value) ||
        !Array.isArray(data.price.node?.origins)))
  ) {
    throw new Error(
      'A resposta não corresponde à publicação, ao período ou ao contrato da calculadora. Tente novamente.',
    );
  }
  return data;
}
