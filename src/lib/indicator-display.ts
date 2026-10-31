import capitals from '../data/capitals.json';

/** Human-readable labels leave the original series and geography IDs available for audit. */
export function geographyLabel(geography: string): string {
  return geography === 'BR'
    ? 'Brasil'
    : (capitals[geography as keyof typeof capitals] ?? geography);
}

export function unitLabel(unit: string): string {
  const labels: Record<string, string> = {
    'BRL/L': 'R$/litro',
    'BRL/basket': 'R$/cesta',
    'BRL/month': 'R$/mês',
    'BRL/month@2025-12:INPC': 'R$/mês a preços de dezembro de 2025 (INPC)',
    'h/basket': 'horas/cesta',
    households: 'domicílios',
    percentage_points: 'pontos percentuais',
  };
  return labels[unit] ?? unit;
}

export function frequencyLabel(frequency?: string): string {
  const labels: Record<string, string> = {
    weekly: 'semanal',
    monthly: 'mensal',
    quarterly: 'trimestral',
    annual: 'anual',
  };
  return frequency ? (labels[frequency] ?? frequency) : '';
}

/** Group digits without converting precise source decimals to floating point. */
export function decimalLabel(value: string): string {
  const [integer, fraction] = value.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}
