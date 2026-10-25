import { policyCatalog } from '@/data/policies';

export function GET() {
  return new Response(JSON.stringify(policyCatalog), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
