import {
  type CalculatorCatalog,
  type CalculatorRequest,
  type CalculatorResult,
  type Employment,
  fetchCalculator,
  type Priority,
  relatedPolicies,
} from '@/lib/calculator';
import { type EvidenceCatalog, evidenceClasses } from '@/lib/evidence-catalog';
import type { PolicyCatalog } from '@/lib/policy-catalog';

export function mountCalculator() {
  const form = document.querySelector<HTMLFormElement>('[data-calculator-form]');
  const config = document.getElementById('calculator-catalog');
  const status = document.querySelector<HTMLElement>('[data-calculator-status]');
  const results = document.querySelector<HTMLElement>('[data-calculator-results]');
  if (!form || !config || !status || !results) return;
  const catalog: CalculatorCatalog & { policies: PolicyCatalog; evidence: EvidenceCatalog } =
    JSON.parse(config.textContent ?? '{}');
  if (!catalog.api || !catalog.publication) return;
  form.hidden = false;
  document.querySelector('[data-calculator-start]')?.remove();
  let pending: AbortController | undefined;
  let generation = 0;
  const invalidate = () => {
    generation++;
    pending?.abort();
    form.removeAttribute('aria-busy');
    results.replaceChildren();
    status.textContent = 'Perfil alterado. Calcule para atualizar os resultados.';
  };
  form.addEventListener('input', invalidate);
  form.addEventListener('change', invalidate);
  form.addEventListener('reset', () => {
    invalidate();
    status.textContent = 'Perfil limpo.';
  });
  function element<K extends keyof HTMLElementTagNameMap>(tag: K, text: string) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }
  function link(parent: HTMLElement, text: string, href: string) {
    const node = element('a', text);
    node.href = href;
    parent.append(node);
  }
  const localized = (value: string) => value.replace('.', ',');
  function show(
    data: CalculatorResult,
    input: CalculatorRequest,
    priorities: Priority[],
    employment: Employment,
  ) {
    const budget = element('section', '');
    budget.append(element('h2', 'Seu orçamento e o cenário'));
    for (const [title, values] of [
      ['Orçamento declarado', data.baseline],
      ['Cenário hipotético', data.scenario],
    ] as const) {
      budget.append(
        element('h3', title),
        element(
          'p',
          `Renda: R$ ${localized(values.income)} · Por pessoa: R$ ${localized(values.per_person)} · Despesas: R$ ${localized(values.expenses)} · Saldo: R$ ${localized(values.remaining)}`,
        ),
        element(
          'p',
          values.expense_share === null
            ? 'Comprometimento sem número: renda zero.'
            : `Despesas declaradas: ${localized(values.expense_share)}% da renda.`,
        ),
      );
    }
    results?.append(budget);
    const reference = element('section', '');
    reference.append(
      element('h2', 'Cesta de referência'),
      element(
        'p',
        `Capital/recorte: ${data.geography === 'not-covered' ? 'Região fora da cobertura' : (catalog.references.find((reference) => reference.geography === data.geography)?.name ?? data.geography)} · Mês: ${data.month}`,
      ),
    );
    if (data.reference_status === 'observed' && data.price?.node) {
      reference.append(
        element('p', `Cesta para um adulto: R$ ${localized(data.price.node.observation.value)}.`),
        element(
          'p',
          data.basket_share === null
            ? 'Percentual da renda sem número: renda familiar zero.'
            : `Uma cesta equivale a ${localized(data.basket_share)}% da renda familiar declarada.`,
        ),
        element(
          'p',
          data.basket_hours === null
            ? 'Tempo individual sem número: informe renda do trabalho e horas da mesma pessoa.'
            : `Tempo equivalente: ${localized(data.basket_hours)} horas, pela sua renda individual do trabalho e jornada declaradas.`,
        ),
      );
      const url = new URL(
        `/api/v1/observations/${data.price.node.observation.id}`,
        catalog.api ?? undefined,
      );
      url.searchParams.set('publication', input.publication);
      link(reference, 'Auditar observação publicada da cesta (JSON)', url.href);
      for (const origin of data.price.node.origins) {
        try {
          const source = new URL(origin.url);
          if (source.protocol !== 'https:') continue;
          const p = element('p', `Coleta: ${origin.retrieved_at} · `);
          link(p, 'Fonte original', source.href);
          reference.append(p);
        } catch {
          /* An invalid source URL is never turned into a link. */
        }
      }
    } else {
      const reasons: Record<string, string> = {
        endpoint_not_covered: 'Capital ou mês sem cobertura nesta edição.',
        endpoint_unavailable: 'Referência ausente ou pendente nesta edição.',
        incompatible_reference: 'Referência incompatível com o método de cesta.',
      };
      reference.append(
        element(
          'p',
          `${reasons[data.reference_reason ?? ''] ?? 'Referência indisponível.'} O orçamento foi calculado com os valores declarados; nenhuma cesta foi estimada.`,
        ),
      );
    }
    results?.append(reference);
    const policies = element('section', '');
    policies.append(
      element('h2', 'Políticas relacionadas ao que você quer investigar'),
      element(
        'p',
        'Seleção relevance-v1. Não é ranking, elegibilidade nem estimativa de efeito individual. O catálogo atual não permite estimar quanto cada política mudaria sua renda.',
      ),
    );
    const matches = relatedPolicies(catalog.policies, catalog.evidence, priorities, employment);
    if (!matches.length)
      policies.append(
        element(
          'p',
          'Nenhuma política relacionada pelos critérios selecionados neste catálogo. Isso não significa ausência de políticas ou de efeitos.',
        ),
      );
    for (const match of matches) {
      const article = element('article', '');
      article.className = 'platform-card';
      const title = element('h3', '');
      link(title, match.policy.name, `/politicas/${match.policy.id}`);
      article.append(
        title,
        element('p', match.reasons.join(' ')),
        element('p', match.policy.limitations),
      );
      if (!match.studies.length)
        article.append(
          element(
            'p',
            'Sem estudo empírico relacionado neste catálogo. Referências metodológicas não estimam o impacto desta política.',
          ),
        );
      for (const study of match.studies) {
        const relation = study.policies.find((item) => item.policy === match.policy.id);
        const heading = element('h4', '');
        link(heading, study.title, `/evidencias/${study.id}`);
        article.append(
          heading,
          element(
            'p',
            `${evidenceClasses[study.assessment.classification]} · ${study.year} · ${study.geography}`,
          ),
          element('p', study.finding),
          element('p', relation?.note ?? ''),
          element('p', `População: ${study.population} Método: ${study.method}`),
          element('p', `Limites: ${study.limitations.join(' ')}`),
        );
        if (study.assessment.classification === 'causal-estimate')
          article.append(
            element(
              'p',
              `Contrafactual: ${study.assessment.counterfactual} Hipóteses: ${study.assessment.assumptions.join(' ')}`,
            ),
          );
      }
      policies.append(article);
    }
    results?.append(policies);
    const audit = element('details', '');
    audit.append(
      element('summary', 'Conferir cálculo e contexto desta simulação'),
      element(
        'p',
        `Publicação: ${input.publication}. Fórmulas ${data.version}; precisão ${data.precision}; arredondamento ${data.rounding}. Políticas ${catalog.policies.revision}; evidências ${catalog.evidence.revision}.`,
      ),
    );
    const pre = element(
      'pre',
      JSON.stringify({ input, employment, priorities, result: data }, null, 2),
    );
    pre.style.whiteSpace = 'pre-wrap';
    audit.append(pre);
    results?.append(audit);
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    invalidate();
    const current = generation;
    pending = new AbortController();
    const values = new FormData(form);
    const value = (key: string) => String(values.get(key) ?? '').trim();
    const input: CalculatorRequest = {
      publication: catalog.publication ?? '',
      version: 'profile-v1',
      geography: value('geography'),
      month: value('month'),
      profile: {
        income: value('income'),
        members: Number(value('members')),
        housing: value('housing'),
        transport: value('transport'),
        other: value('other'),
        income_change: value('income_change'),
        ...(value('labor_income') ? { labor_income: value('labor_income') } : {}),
        ...(value('monthly_hours') ? { monthly_hours: value('monthly_hours') } : {}),
      },
    };
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Calculando com a publicação desta página…';
    try {
      const data = await fetchCalculator(catalog.api ?? '', input, pending.signal);
      if (generation !== current) return;
      show(data, input, values.getAll('priority') as Priority[], value('employment') as Employment);
      status.textContent =
        'Cálculo concluído. Resultados abaixo; confira as hipóteses e referências.';
    } catch (error) {
      if (generation !== current) return;
      status.textContent =
        error instanceof Error && error.name === 'TimeoutError'
          ? 'A consulta demorou demais. Tente novamente.'
          : error instanceof TypeError
            ? 'Não foi possível acessar a API. Verifique sua conexão e tente novamente.'
            : error instanceof Error
              ? error.message
              : 'Não foi possível calcular. Tente novamente.';
    } finally {
      if (generation === current) form.removeAttribute('aria-busy');
    }
  });
}
