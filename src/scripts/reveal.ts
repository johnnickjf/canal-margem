/**
 * Revelação no scroll: elementos com `data-reveal` entram com deslocamento curto.
 * Filhos de um `data-reveal-group` recebem atraso escalonado automaticamente.
 * Sem efeito quando o usuário prefere movimento reduzido (ver base.css).
 */

const groups = document.querySelectorAll<HTMLElement>('[data-reveal-group]');
groups.forEach((group) => {
  group.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, i) => {
    el.style.setProperty('--reveal-i', String(i % 6));
  });
});

const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  targets.forEach((el) => observer.observe(el));
} else {
  targets.forEach((el) => el.classList.add('is-visible'));
}
