import type { APIRoute } from 'astro';
import { getArticles, getTemas, getVideos, routes } from '@/lib/content';
import { episodeCode, formatDateMono } from '@/lib/format';
import { plainHeadline } from '@/lib/headline';
import { platform } from '@/lib/platform';
import { platformSearchItems } from '@/lib/platform-search';
import type { SearchItem } from '@/lib/search';

/** Índice estático para a busca no cliente. Gerado no build, sem servidor. */
export const GET: APIRoute = async () => {
  const [videos, articles, temas] = await Promise.all([getVideos(), getArticles(), getTemas()]);
  const temaName = new Map(temas.map((t) => [t.id, t.data.name]));

  const items: SearchItem[] = [
    ...platformSearchItems(platform),
    ...videos.map((video) => ({
      type: video.data.format === 'corte' ? ('Corte' as const) : ('Episódio' as const),
      title: plainHeadline(video.data.title),
      text: [
        video.data.dek,
        video.body ?? '',
        video.data.chapters.map((c) => c.label).join(' '),
      ].join(' '),
      url: routes.video(video),
      meta: [
        episodeCode(video.data.episode),
        temaName.get(video.data.tema.id),
        video.data.duration,
      ].join(' / '),
    })),
    ...articles.map((article) => ({
      type: 'Análise' as const,
      title: plainHeadline(article.data.title),
      text: `${article.data.dek} ${article.body ?? ''}`,
      url: routes.article(article),
      meta: [temaName.get(article.data.tema.id), formatDateMono(article.data.publishedAt)].join(
        ' / ',
      ),
    })),
    ...temas.map((tema) => ({
      type: 'Tema' as const,
      title: tema.data.name,
      text: `${tema.data.question} ${tema.data.summary}`,
      url: routes.tema(tema.id),
      meta: 'Tema',
    })),
  ];

  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
