function hashTarget(hash: string): HTMLElement | null {
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null;
  }
}

function focusDestination(target: HTMLElement) {
  if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
    target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
  }
  target.focus({ preventScroll: true });
}

/** Aprimoramento progressivo: o mesmo conteúdo passa de details para dialog. */
export function initDialogs() {
  document.querySelectorAll<HTMLElement>('[data-ui-dialog-shell]').forEach((shell) => {
    if (shell.dataset.ready) return;
    const dialog = shell.querySelector<HTMLDialogElement>('[data-ui-dialog]');
    const trigger = shell.querySelector<HTMLAnchorElement>('[data-ui-dialog-trigger]');
    const fallback = shell.querySelector<HTMLDetailsElement>('[data-ui-dialog-fallback]');
    const content = shell.querySelector<HTMLElement>('[data-ui-dialog-content]');
    const close = shell.querySelector<HTMLButtonElement>('[data-ui-dialog-close]');
    if (!dialog || !trigger || !fallback || !content || !close || !dialog.showModal) return;
    shell.dataset.ready = 'true';
    dialog.append(content);
    fallback.hidden = true;
    close.hidden = false;
    trigger.setAttribute('aria-controls', dialog.id);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    let navigationTarget: HTMLElement | null = null;
    const open = () => {
      navigationTarget = null;
      if (!dialog.open) dialog.showModal();
      trigger.setAttribute('aria-expanded', 'true');
      content.querySelector<HTMLElement>('[data-ui-dialog-heading]')?.focus();
    };
    trigger.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      open();
    });
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const focusable = [
        ...dialog.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]',
        ),
      ].filter(
        (element) =>
          element.tabIndex >= 0 &&
          !element.matches(':disabled') &&
          element.getClientRects().length > 0,
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !focusable.includes(document.activeElement as HTMLElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    dialog.addEventListener('click', (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (link && !link.hasAttribute('download') && (!link.target || link.target === '_self')) {
        const url = new URL(link.href, location.href);
        if (
          url.origin === location.origin &&
          url.pathname === location.pathname &&
          url.search === location.search
        ) {
          const target = hashTarget(url.hash);
          if (target && !dialog.contains(target)) {
            // Fechar antes da navegação nativa libera a rolagem e o destino do link.
            navigationTarget = target;
            dialog.close();
            return;
          }
        }
      }
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      trigger.setAttribute('aria-expanded', 'false');
      // O evento close é assíncrono: não roubar o foco do destino da navegação.
      focusDestination(navigationTarget ?? trigger);
      navigationTarget = null;
    });
    const syncHash = () => {
      const target = hashTarget(location.hash);
      if (target && dialog.contains(target)) open();
      else if (dialog.open) {
        navigationTarget = target;
        dialog.close();
      }
    };
    window.addEventListener('hashchange', syncHash);
    window.addEventListener(
      'load',
      () => {
        // A navegação inicial pelo fragmento pode redefinir o foco após os scripts.
        if (
          dialog.open &&
          dialog.contains(hashTarget(location.hash)) &&
          !dialog.contains(document.activeElement)
        ) {
          content.querySelector<HTMLElement>('[data-ui-dialog-heading]')?.focus();
        }
      },
      { once: true },
    );
    syncHash();
  });
}
