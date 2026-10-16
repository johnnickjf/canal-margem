export function initTabs() {
  document.querySelectorAll<HTMLElement>('[data-ui-tabs]').forEach((root) => {
    if (root.dataset.ready) return;
    const list = root.querySelector<HTMLElement>('[data-ui-tablist]');
    const tabs = [...root.querySelectorAll<HTMLAnchorElement>('[data-ui-tab]')].filter(
      (tab) => tab.closest('[data-ui-tabs]') === root,
    );
    const panels = [...root.querySelectorAll<HTMLElement>('[data-ui-panel]')].filter(
      (panel) => panel.closest('[data-ui-tabs]') === root,
    );
    if (!list || !tabs.length || panels.length !== tabs.length) return;
    root.dataset.ready = 'true';
    list.setAttribute('role', 'tablist');
    const select = (index: number, focus = false) => {
      tabs.forEach((tab, i) => {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(i === index));
        tab.setAttribute('aria-controls', panels[i].id);
        tab.tabIndex = i === index ? 0 : -1;
        panels[i].setAttribute('role', 'tabpanel');
        panels[i].tabIndex = 0;
        panels[i].hidden = i !== index;
      });
      if (focus) tabs[index].focus();
    };
    const fromHash = () => panels.findIndex((panel) => `#${panel.id}` === location.hash);
    const initial = fromHash();
    select(
      initial >= 0
        ? initial
        : Math.max(
            0,
            tabs.findIndex((tab) => tab.dataset.uiTab === root.dataset.selected),
          ),
    );
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        select(index);
      });
      tab.addEventListener('keydown', (event) => {
        const next = {
          ArrowRight: (index + 1) % tabs.length,
          ArrowLeft: (index - 1 + tabs.length) % tabs.length,
          Home: 0,
          End: tabs.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
      });
    });
    window.addEventListener('hashchange', () => {
      const index = fromHash();
      if (index >= 0) select(index);
    });
  });
}
