const MONTHS_SHORT = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const longDate = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `21` → `M / 021` (manual, seção 17). */
export function episodeCode(episode: number): string {
  return `M / ${String(episode).padStart(3, '0')}`;
}

/** Datas editoriais em mono: `02.10.2026`. */
export function formatDateMono(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getUTCFullYear()}`;
}

/** `02 OUT 2026` */
export function formatDateShort(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${d} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `2 de outubro de 2026` */
export function formatDateLong(date: Date): string {
  return longDate.format(date);
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Tempo de leitura em minutos (média de 200 palavras/minuto em português). */
export function readingTime(text = ''): number {
  const words = text.replace(/[#>*_`\-[\]()]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** `24:18` → `PT24M18S` (ISO 8601, para metadados de vídeo). */
export function durationToISO(duration: string): string {
  const parts = duration.split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${s}S`;
}

export function padIndex(index: number, size = 2): string {
  return String(index).padStart(size, '0');
}
