import { evidenceCatalog } from '@/data/evidence';

export function GET() {
  return new Response(JSON.stringify(evidenceCatalog), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
