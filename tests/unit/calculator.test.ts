import { describe, expect, it, vi } from 'vitest';
import definitions from '../../backend/internal/publications/indicators.json';
import evidence from '../../src/data/evidence.json';
import policies from '../../src/data/policies.json';
import {
  type CalculatorRequest,
  calculatorCatalog,
  fetchCalculator,
  relatedPolicies,
} from '../../src/lib/calculator';
import { validateEvidenceCatalog } from '../../src/lib/evidence-catalog';
import type { Platform } from '../../src/lib/platform-build';
import { validatePolicyCatalog } from '../../src/lib/policy-catalog';

const policyCatalog = validatePolicyCatalog(
  policies,
  definitions.map((item) => item.slug),
);
const evidenceCatalog = validateEvidenceCatalog(
  evidence,
  policyCatalog,
  definitions.map((item) => item.slug),
);
const input: CalculatorRequest = {
  publication: 'a'.repeat(64),
  version: 'profile-v1',
  geography: 'capital',
  month: '2025-01',
  profile: {
    income: '0',
    members: 1,
    housing: '0',
    transport: '0',
    other: '0',
    income_change: '0',
  },
};
function response() {
  const budget = {
    income: '0',
    per_person: '0',
    expenses: '0',
    remaining: '0',
    expense_share: null,
  };
  return {
    publication: input.publication,
    data: {
      version: input.version,
      precision: 12,
      rounding: 'half_even',
      geography: input.geography,
      month: input.month,
      baseline: budget,
      scenario: budget,
      basket_share: null,
      basket_hours: null,
      reference_status: 'not_computed',
      formulas: { remaining: 'income - expenses' },
    },
  };
}
describe('calculator context and privacy', () => {
  it('sends a bounded POST body with pinned edition, no query, credentials or cache', async () => {
    const request = vi.fn().mockResolvedValue(Response.json(response()));
    expect(
      (await fetchCalculator('https://api.example', input, new AbortController().signal, request))
        .baseline.income,
    ).toBe('0');
    expect(request.mock.calls[0][0]).toBe('https://api.example/api/v1/calculator');
    expect(request.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      body: JSON.stringify(input),
    });
  });
  it('rejects context drift and malformed numerical results', async () => {
    for (const mutate of [
      (body: ReturnType<typeof response>) => {
        body.publication = 'b'.repeat(64);
      },
      (body: ReturnType<typeof response>) => {
        body.data.month = '2025-02';
      },
      (body: ReturnType<typeof response>) => {
        body.data.baseline.remaining = 'NaN';
      },
      (body: ReturnType<typeof response>) => {
        body.data.version = 'wrong' as 'profile-v1';
      },
      (body: ReturnType<typeof response>) => {
        body.data.reference_status = 'observed';
      },
    ]) {
      const body = response();
      mutate(body);
      await expect(
        fetchCalculator(
          'https://api.example',
          input,
          new AbortController().signal,
          vi.fn().mockResolvedValue(Response.json(body)),
        ),
      ).rejects.toThrow('contrato');
    }
  });
  it('reports expired editions, throttling and unavailability without switching publication', async () => {
    for (const status of [400, 410, 429, 503])
      await expect(
        fetchCalculator(
          'https://api.example',
          input,
          new AbortController().signal,
          vi.fn().mockResolvedValue(new Response('', { status })),
        ),
      ).rejects.toThrow();
  });
  it('uses only basket geography coverage captured in the build', () => {
    expect(
      calculatorCatalog({ api: null, publication: null, selections: {} } as Platform).references,
    ).toEqual([]);
  });
});
describe('relevance-v1 is explicit navigation', () => {
  it('relates food priority to minimum policy and historical Bolsa studies, without methodology as empirical impact', () => {
    const matches = relatedPolicies(policyCatalog, evidenceCatalog, ['alimentacao'], 'formal');
    expect(matches.map((match) => match.policy.id)).toEqual([
      'valorizacao-salario-minimo-2024',
      'bolsa-familia-2023',
    ]);
    expect(matches[0].studies).toEqual([]);
    expect(matches[1].studies).toHaveLength(2);
    expect(
      matches[1].studies.every((study) => study.policies[0].applicability === 'historical-program'),
    ).toBe(true);
  });
  it('uses retirement only as a navigation relation; unsupported priorities get no fabricated policy', () => {
    expect(relatedPolicies(policyCatalog, evidenceCatalog, [], 'retired')[0].policy.id).toBe(
      'reforma-previdenciaria-2019',
    );
    expect(relatedPolicies(policyCatalog, evidenceCatalog, ['moradia'], 'other')).toEqual([]);
  });
});
