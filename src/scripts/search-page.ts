import { type SearchItem, searchFilter } from '@/lib/search';
import { createSearch } from './search';

export function mountSearch() {
  const form = document.querySelector<HTMLFormElement>('[data-search-form]');
  const input = document.querySelector<HTMLInputElement>('[data-search-input]');
  const type = document.querySelector<HTMLSelectElement>('[data-search-type]');
  const list = document.querySelector<HTMLOListElement>('[data-search-results]');
  const status = document.querySelector<HTMLElement>('[data-search-status]');
  const suggest = document.querySelector<HTMLElement>('[data-search-suggest]');
  const retry = document.querySelector<HTMLButtonElement>('[data-search-retry]');
  if (!form || !input || !type || !list || !status || !suggest || !retry) return;

  const search = createSearch('/busca.json');
  let revision = 0;
  let timer: number | undefined;

  function result(item: SearchItem) {
    const li = document.createElement('li');
    li.className = 'result';
    const link = document.createElement('a');
    link.href = item.url;
    for (const [className, text] of [
      ['type', item.type],
      ['title', item.title],
      ['meta', item.meta],
      ...(item.type === 'Indicador' || item.type === 'Entenda' ? [['description', item.text]] : []),
    ]) {
      const span = document.createElement('span');
      span.className = `result__${className}`;
      span.textContent = text;
      link.append(span);
    }
    li.append(link);
    return li;
  }

  async function render() {
    if (!input || !type || !list || !status || !suggest || !retry) return;
    const current = ++revision;
    const query = input.value.trim();
    retry.hidden = true;
    list.replaceChildren();
    suggest.hidden = query.length > 0;
    status.textContent = query ? 'Buscando…' : '';
    list.setAttribute('aria-busy', String(Boolean(query)));
    if (!query) return;
    try {
      const results = await search(query, searchFilter(type.value));
      if (current !== revision) return;
      status.textContent = results.length
        ? `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'} para “${query}”`
        : `Nada encontrado para “${query}”. Tente outra palavra ou navegue pelos temas.`;
      suggest.hidden = results.length > 0;
      list.replaceChildren(...results.map(result));
    } catch {
      if (current !== revision) return;
      status.textContent =
        'Não foi possível carregar a busca. Tente novamente ou explore os indicadores e temas abaixo.';
      retry.hidden = false;
      suggest.hidden = false;
    } finally {
      if (current === revision) list.setAttribute('aria-busy', 'false');
    }
  }

  function update() {
    if (!input || !type) return;
    window.clearTimeout(timer);
    const url = new URL(location.href);
    if (input.value.trim()) url.searchParams.set('q', input.value.trim());
    else url.searchParams.delete('q');
    if (type.value) url.searchParams.set('tipo', type.value);
    else url.searchParams.delete('tipo');
    history.replaceState(null, '', url);
    void render();
  }

  function fromURL() {
    if (!input || !type) return;
    window.clearTimeout(timer);
    const params = new URLSearchParams(location.search);
    input.value = (params.get('q') ?? '').slice(0, 200);
    type.value = searchFilter(params.get('tipo'));
    void render();
  }

  input.addEventListener('input', () => {
    ++revision; // Invalida consultas pendentes antes do debounce.
    window.clearTimeout(timer);
    timer = window.setTimeout(update, 120);
  });
  type.addEventListener('change', update);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    update();
  });
  retry.addEventListener('click', update);
  window.addEventListener('popstate', fromURL);
  for (const example of document.querySelectorAll<HTMLAnchorElement>('[data-search-example]')) {
    example.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      event.preventDefault();
      input.value = example.dataset.searchExample ?? '';
      update();
    });
  }
  fromURL();
}
