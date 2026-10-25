import type { HistoryPoint } from './platform-build';
import { timelineX } from './policy-catalog';

export function decimalDirection(value: string): 'up' | 'down' | 'flat' {
  if (/^-?0+(\.0+)?$/.test(value)) return 'flat';
  return value.startsWith('-') ? 'down' : 'up';
}

/** Decimal arithmetic is used only for SVG coordinates, never to calculate an indicator. */
export function historyChart(history: HistoryPoint[]) {
  const available = history.filter(
    (point) => point.status === 'observed' && point.node?.observation.value != null,
  );
  if (available.length === 0) return null;
  const values = available.map((point) => point.node?.observation.value as string);
  const scale = Math.max(...values.map((value) => value.split('.')[1]?.length ?? 0));
  const integer = (value: string) => {
    const [whole, fraction = ''] = value.replace('-', '').split('.');
    return BigInt(whole + fraction.padEnd(scale, '0')) * (value.startsWith('-') ? -1n : 1n);
  };
  const numbers = values.map(integer);
  const min = numbers.reduce((a, b) => (a < b ? a : b));
  const max = numbers.reduce((a, b) => (a > b ? a : b));
  const segments: string[] = [];
  const dots: { x: number; y: number; label: string }[] = [];
  let segment: string[] = [];
  let previousContext: string | undefined;
  function flush() {
    if (segment.length > 1) segments.push(segment.join(' '));
    segment = [];
  }
  for (const point of history) {
    const value = point.node?.observation.value;
    if (point.status !== 'observed' || value == null) {
      flush();
      continue;
    }
    const context = point.node?.observation.context;
    const comparability = JSON.stringify([
      context?.method,
      context?.method_segment,
      context?.unit,
      context?.monetary_base,
      context?.composition,
      context?.deflator,
      context?.index_base_period,
    ]);
    if (comparability !== previousContext) flush();
    previousContext = comparability;
    const x = timelineX(point.end, history[0].end, history[history.length - 1].end);
    const y =
      max === min ? 130 : 230 - Number(((integer(value) - min) * 200_000n) / (max - min)) / 1000;
    segment.push(`${x},${y}`);
    dots.push({ x, y, label: `${point.start} a ${point.end}: ${value.replace('.', ',')}` });
  }
  flush();
  return {
    segments,
    dots,
    min: values[numbers.indexOf(min)],
    max: values[numbers.indexOf(max)],
    first: history[0].end,
    last: history[history.length - 1].end,
  };
}
