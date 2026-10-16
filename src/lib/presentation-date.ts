/** Datas de apresentação não definem políticas de atualização ou comparabilidade. */
export function presentationDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Data deve usar YYYY-MM-DD: ${value}`);
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Data inválida: ${value}`);
  }
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}
