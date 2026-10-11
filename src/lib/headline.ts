/**
 * Títulos editoriais usam colchetes para marcar o trecho em vermelho:
 *   "O preço do [aluguel]" → { before: "O preço do ", highlight: "aluguel", after: "" }
 */
export type HeadlineParts = {
  before: string;
  highlight: string;
  after: string;
};

const HIGHLIGHT = /\[([^\]]+)\]/;

export function parseHeadline(title: string): HeadlineParts {
  const match = title.match(HIGHLIGHT);
  if (!match || match.index === undefined) {
    return { before: title, highlight: '', after: '' };
  }
  return {
    before: title.slice(0, match.index),
    highlight: match[1],
    after: title.slice(match.index + match[0].length),
  };
}

/** Versão sem marcação, para <title>, alt, metadados e busca. */
export function plainHeadline(title: string): string {
  return title.replace(HIGHLIGHT, '$1');
}
