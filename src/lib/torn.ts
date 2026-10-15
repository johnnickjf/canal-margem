/**
 * Bordas de papel rasgado geradas de forma determinística.
 *
 * O resultado é um `clip-path: polygon(...)` — sem imagens extras, nítido em qualquer
 * resolução e estável entre builds (a mesma `seed` sempre gera a mesma borda).
 */

type Side = 'left' | 'right' | 'top' | 'bottom';

type TornOptions = {
  seed?: number;
  /** Profundidade máxima do rasgo, em % do lado perpendicular. */
  depth?: number;
  /** Número de pontos ao longo da borda. */
  steps?: number;
};

function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pct = (n: number) => `${Number(n.toFixed(2))}%`;

function edge(rand: () => number, depth: number, steps: number): number[] {
  const values: number[] = [];
  let drift = depth / 2;
  for (let i = 0; i <= steps; i += 1) {
    // Combina deriva lenta (fibra) com picos curtos (rasgo).
    drift += (rand() - 0.5) * depth * 0.6;
    drift = Math.min(depth, Math.max(0, drift));
    const spike = rand() > 0.82 ? rand() * depth * 0.5 : 0;
    values.push(Math.min(depth, drift + spike));
  }
  return values;
}

export function tornClipPath(
  side: Side,
  { seed = 7, depth = 3, steps = 48 }: TornOptions = {},
): string {
  const offsets = edge(random(seed), depth, steps);
  const along = (i: number) => (i / steps) * 100;
  let points: string[];

  switch (side) {
    case 'left':
      points = [
        '100% 0%',
        '100% 100%',
        ...offsets.map((o, i) => `${pct(o)} ${pct(100 - along(i))}`),
      ];
      break;
    case 'right':
      points = ['0% 0%', ...offsets.map((o, i) => `${pct(100 - o)} ${pct(along(i))}`), '0% 100%'];
      break;
    case 'top':
      points = [...offsets.map((o, i) => `${pct(along(i))} ${pct(o)}`), '100% 100%', '0% 100%'];
      break;
    case 'bottom':
      points = [
        '0% 0%',
        '100% 0%',
        ...offsets.map((o, i) => `${pct(100 - along(i))} ${pct(100 - o)}`),
      ];
      break;
  }

  return `polygon(${points.join(', ')})`;
}

/** Recorte rasgado nos dois lados verticais — para tiras de papel/colagem. */
export function tornStripClipPath({ seed = 11, depth = 6, steps = 40 }: TornOptions = {}): string {
  const rand = random(seed);
  const left = edge(rand, depth, steps);
  const right = edge(rand, depth, steps);
  const along = (i: number) => (i / steps) * 100;
  const points = [
    ...right.map((o, i) => `${pct(100 - o)} ${pct(along(i))}`),
    ...left.map((o, i) => `${pct(o)} ${pct(100 - along(i))}`),
  ];
  return `polygon(${points.join(', ')})`;
}
