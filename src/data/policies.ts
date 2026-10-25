import { validatePolicyCatalog } from '@/lib/policy-catalog';
import indicators from '../../backend/internal/publications/indicators.json';
import raw from './policies.json';

export const policyCatalog = validatePolicyCatalog(
  raw,
  indicators.map((item) => item.slug),
);
export const policies = policyCatalog.policies;
