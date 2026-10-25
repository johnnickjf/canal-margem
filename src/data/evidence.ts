import { validateEvidenceCatalog } from '@/lib/evidence-catalog';
import indicators from '../../backend/internal/publications/indicators.json';
import raw from './evidence.json';
import { policyCatalog } from './policies';

export const evidenceCatalog = validateEvidenceCatalog(
  raw,
  policyCatalog,
  indicators.map((item) => item.slug),
);
