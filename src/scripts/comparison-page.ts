import {
  assessmentLabels,
  type ComparisonCatalog,
  type ComparisonQuery,
  type ComparisonResult,
  comparisonURL,
  fetchComparison,
  reasonLabels,
} from '@/lib/comparison';
import { frequencyLabel, geographyLabel, unitLabel } from '@/lib/indicator-display';
import type { HistoryPoint } from '@/lib/platform-build';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
function link(text: string, href: string) {
  const node = element('a', text);
  node.href = href;
  return node;
}
export function mountComparison() {
  const form = document.querySelector<HTMLFormElement>('[data-comparison-form]');
  const status = document.querySelector<HTMLElement>('[data-comparison-status]');
  const results = document.querySelector<HTMLElement>('[data-comparison-results]');
  const initial = document.querySelector<HTMLElement>('[data-comparison-init]');
  const data = document.querySelector('#comparison-catalog');
  if (!form || !status || !results || !initial || !data) return;
  const catalog: ComparisonCatalog = JSON.parse(data.textContent ?? '{}');
  initial.hidden = true;
  if (!catalog.api || !catalog.publication) return;
  form.hidden = false;
  mountControls(form, status, results, catalog);
}

function mountControls(
  form: HTMLFormElement,
  status: HTMLElement,
  results: HTMLElement,
  catalog: ComparisonCatalog,
) {
  const field = (name: string) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement;
  let revision = 0;
  let active: AbortController | undefined;

  function invalidate() {
    ++revision;
    active?.abort();
    results.replaceChildren();
    results.setAttribute('aria-busy', 'false');
    status.textContent = 'Seleção alterada. Use “Comparar períodos selecionados” para consultar.';
  }
  function filterThemes() {
    for (const group of form.querySelectorAll<HTMLFieldSetElement>('[data-comparison-theme]')) {
      group.hidden = Boolean(
        field('theme').value && group.dataset.comparisonTheme !== field('theme').value,
      );
      group.disabled = group.hidden;
    }
  }
  function chosen() {
    const slugs = new FormData(form).getAll('indicator');
    return catalog.indicators.filter((indicator) => slugs.includes(indicator.slug));
  }
  function writeURL() {
    const url = new URL(location.href);
    url.search = '';
    for (const name of ['theme', 'from', 'to', 'calculation']) {
      if (field(name).value) url.searchParams.set(name, field(name).value);
    }
    url.searchParams.set('publication', catalog.publication as string);
    for (const indicator of chosen()) {
      url.searchParams.append('indicator', indicator.slug);
      url.searchParams.set(
        `selection-${indicator.slug}`,
        field(`selection-${indicator.slug}`).value,
      );
    }
    history.pushState(null, '', url);
  }
  function pinned(path: string, params: Record<string, string> = {}) {
    return `${catalog.api}/api/v1/${path}?${new URLSearchParams({ ...params, publication: catalog.publication as string })}`;
  }
  function evidence(point: HistoryPoint, name: string, unit: string) {
    const section = element('section');
    section.append(element('h5', name));
    section.append(element('p', `Período: ${point.start} a ${point.end}`));
    const node = point.node;
    section.append(
      element(
        'p',
        `Valor: ${node?.observation.value?.replace('.', ',') ?? 'indisponível'} ${unitLabel(unit)}`,
      ),
    );
    section.append(
      element('p', `Estado: ${point.status}${point.reason ? ` · ${point.reason}` : ''}`),
    );
    if (node) {
      section.append(
        link(`Observação: ${node.observation.id}`, pinned(`observations/${node.observation.id}`)),
      );
      for (const [key, value] of Object.entries(node.observation.context ?? {})) {
        section.append(
          element('p', `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`),
        );
      }
      if (node.evaluation) {
        section.append(
          element(
            'p',
            `Cálculo de origem: ${node.evaluation.request.calculation}/${node.evaluation.request.version}`,
          ),
        );
        for (const [role, id] of Object.entries(node.evaluation.request.inputs)) {
          section.append(link(`Entrada ${role}: ${id}`, pinned(`observations/${id}`)));
        }
      }
      for (const origin of node.origins ?? []) {
        if (!URL.canParse(origin.url)) continue;
        const url = new URL(origin.url);
        if (['https:', 'http:'].includes(url.protocol)) {
          section.append(link('Fonte original', url.href));
          section.append(element('p', `Coleta: ${origin.retrieved_at}`));
        }
      }
    }
    return section;
  }
  function renderResult(
    article: HTMLElement,
    result: ComparisonResult,
    query: ComparisonQuery,
    unit: string,
  ) {
    article.dataset.assessment = result.assessment.status;
    article.append(element('p', assessmentLabels[result.assessment.status]));
    if (result.status === 'computed') {
      const outputUnit = result.evaluation?.output.context.unit ?? '';
      article.append(
        element(
          'p',
          `${query.calculation === 'difference' ? 'Diferença absoluta' : 'Variação percentual'}: ${result.value?.replace('.', ',')} ${unitLabel(outputUnit)}`,
        ),
      );
      article.append(
        element(
          'p',
          `Direção dos valores publicados: ${{ up: 'alta', down: 'queda', flat: 'sem mudança', unavailable: 'indisponível' }[result.assessment.direction]}.`,
        ),
      );
    } else {
      article.append(
        element(
          'p',
          reasonLabels[result.reason ?? ''] ??
            'Um dos valores não pode ser usado neste cálculo. Confira os estados e metadados dos períodos na auditoria.',
        ),
      );
      if (result.reason) article.append(element('p', `Motivo: ${result.reason}`));
    }
    const details = element('details');
    details.append(element('summary', 'Conferir dados, regra e fontes'));
    details.append(element('p', `Regra ${result.assessment.version}: ${result.assessment.rule}`));
    if (result.evaluation) {
      details.append(
        element(
          'p',
          `Fórmula: ${result.evaluation.definition.formula} · ${result.calculation}/${result.version}`,
        ),
      );
      details.append(element('p', result.evaluation.definition.methodology));
      details.append(
        element(
          'p',
          `Precisão: ${result.evaluation.definition.precision} casas decimais; arredondamento ${result.evaluation.definition.rounding}.`,
        ),
      );
      for (const warning of result.evaluation.warnings ?? []) details.append(element('p', warning));
    }
    if (result.previous) details.append(evidence(result.previous, 'Período inicial', unit));
    if (result.current) details.append(evidence(result.current, 'Período final', unit));
    details.append(link('Consultar comparação completa (JSON)', comparisonURL(catalog, query)));
    details.append(element('p', `Publicação: ${catalog.publication}`));
    article.append(details);
  }
  async function compare(save = true) {
    invalidate();
    const currentRevision = revision;
    const from = field('from').value;
    const to = field('to').value;
    if (!form.reportValidity()) return;
    if (from >= to || Number(to.slice(0, 4)) - Number(from.slice(0, 4)) > 100) {
      status.textContent = 'O início deve vir antes do fim, em um intervalo de até 100 anos.';
      status.focus();
      return;
    }
    const indicators = chosen();
    if (!indicators.length) {
      status.textContent = 'Selecione pelo menos um indicador do tema visível.';
      status.focus();
      return;
    }
    if (save) writeURL();
    active = new AbortController();
    const signal = active.signal;
    results.setAttribute('aria-busy', 'true');
    status.textContent = `Comparando ${indicators.length} indicador(es)…`;
    let failures = 0;
    try {
      for (const theme of catalog.themes) {
        const items = indicators.filter((indicator) => indicator.theme === theme.slug);
        if (!items.length) continue;
        const group = element('section');
        group.append(element('h3', theme.name));
        results.append(group);
        for (const indicator of items) {
          if (currentRevision !== revision) return;
          const article = element('article');
          article.className = 'platform-card';
          const title = element('h4');
          title.append(link(indicator.name, `/indicador/${indicator.slug}`));
          article.append(title);
          group.append(article);
          const selection =
            indicator.selections[Number(field(`selection-${indicator.slug}`).value)];
          if (!selection) {
            article.append(
              element('p', 'Sem dados suficientes: indicador sem cobertura nesta publicação.'),
            );
            const details = element('details');
            details.append(element('summary', 'Conferir definição e ausência de cobertura'));
            details.append(element('p', indicator.definition));
            details.append(
              element(
                'p',
                `Extremos solicitados: ${from} a ${to}. Nenhum recorte foi publicado para este indicador nesta edição; não há valores usados ou mudança calculada.`,
              ),
            );
            details.append(element('p', `Publicação: ${catalog.publication}`));
            details.append(
              link(
                'Consultar indicador desta publicação (JSON)',
                pinned(`indicators/${indicator.slug}`),
              ),
            );
            article.append(details);
            continue;
          }
          article.append(
            element(
              'p',
              `Recorte: ${geographyLabel(selection.geography)} · ${selection.series} · ${unitLabel(selection.unit)} · ${frequencyLabel(selection.frequency)}`,
            ),
          );
          article.append(
            element('p', `Dataset: ${selection.dataset} · Método: ${selection.method}`),
          );
          for (const warning of selection.warnings ?? []) article.append(element('p', warning));
          const query: ComparisonQuery = {
            series: selection.series,
            geography: selection.geography,
            from,
            to,
            calculation: field('calculation').value as ComparisonQuery['calculation'],
          };
          try {
            const result = await fetchComparison(catalog, query, signal);
            if (currentRevision !== revision) return;
            const content = element('div');
            renderResult(content, result, query, selection.unit);
            article.dataset.assessment = content.dataset.assessment;
            article.append(...content.childNodes);
          } catch (error) {
            if (currentRevision !== revision) return;
            failures++;
            article.append(
              element('p', 'Consulta não concluída. Não é possível avaliar este indicador.'),
            );
            article.append(
              element(
                'p',
                error instanceof Error && error.name !== 'TimeoutError'
                  ? error.message
                  : 'A consulta excedeu o tempo de espera. Tente novamente.',
              ),
            );
          }
        }
      }
    } finally {
      if (currentRevision === revision) {
        results.setAttribute('aria-busy', 'false');
        status.textContent = `Comparação concluída para ${indicators.length} indicador(es).${failures ? ` ${failures} consulta(s) falharam; use o botão de comparar para tentar novamente.` : ''} Expanda cada resultado para conferir os dados. Não há score agregado nem atribuição de causalidade.`;
        status.focus();
      }
    }
  }
  function restore() {
    invalidate();
    const params = new URLSearchParams(location.search);
    let invalid = false;
    form.reset();
    field('from').value = params.get('from') ?? catalog.starts[0] ?? '';
    field('to').value = params.get('to') ?? catalog.ends.at(-1) ?? '';
    field('theme').value = params.get('theme') ?? '';
    if (!field('theme').value) {
      invalid = Boolean(params.get('theme'));
      field('theme').value = '';
    }
    field('calculation').value =
      params.get('calculation') === 'relative-change' ? 'relative-change' : 'difference';
    for (const checkbox of form.querySelectorAll<HTMLInputElement>('input[name="indicator"]')) {
      checkbox.checked = params.getAll('indicator').includes(checkbox.value);
      const selection = field(`selection-${checkbox.value}`);
      const requested = params.get(`selection-${checkbox.value}`);
      if (requested !== null) selection.value = requested;
      if (requested !== null && selection.value !== requested) invalid = true;
      if (!selection.value) selection.value = '0';
    }
    filterThemes();
    if (params.has('publication') && params.get('publication') !== catalog.publication) {
      status.textContent =
        'Este link aponta para outra edição. Os controles mostram a publicação desta página; revise a seleção e compare novamente. Não repetimos a comparação automaticamente.';
      return;
    }
    if (
      invalid ||
      params
        .getAll('indicator')
        .some((slug) => !catalog.indicators.some((indicator) => indicator.slug === slug))
    ) {
      status.textContent =
        'O link contém um tema, indicador ou recorte inválido. Revise a seleção antes de comparar.';
      return;
    }
    status.textContent = 'Escolha os indicadores e confira os períodos antes de comparar.';
    if (params.getAll('indicator').length && params.get('publication') === catalog.publication)
      void compare(false);
  }
  form.addEventListener('input', invalidate);
  field('theme').addEventListener('change', filterThemes);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void compare();
  });
  window.addEventListener('popstate', restore);
  restore();
}
