import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { site } from '@/config/site';
import { getArticles, getEpisodes, routes } from '@/lib/content';
import { episodeCode } from '@/lib/format';
import { plainHeadline } from '@/lib/headline';

export async function GET(context: APIContext) {
  const [episodes, articles] = await Promise.all([getEpisodes(), getArticles()]);

  const items = [
    ...episodes.map((video) => ({
      title: `${episodeCode(video.data.episode)} — ${plainHeadline(video.data.title)}`,
      description: video.data.dek,
      pubDate: video.data.publishedAt,
      link: routes.video(video),
    })),
    ...articles.map((article) => ({
      title: plainHeadline(article.data.title),
      description: article.data.dek,
      pubDate: article.data.publishedAt,
      link: routes.article(article),
    })),
  ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({
    title: `${site.name} — ${site.signature.join(' / ')}`,
    description: site.description,
    site: context.site ?? site.url,
    items,
    customData: '<language>pt-br</language>',
  });
}
