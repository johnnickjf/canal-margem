import { type CollectionEntry, getCollection, getEntry } from 'astro:content';

export type Video = CollectionEntry<'videos'>;
export type Article = CollectionEntry<'analises'>;
export type Tema = CollectionEntry<'temas'>;

const isPublished = ({ data }: { data: { draft?: boolean } }) => import.meta.env.DEV || !data.draft;

const byDateDesc = (a: { data: { publishedAt: Date } }, b: { data: { publishedAt: Date } }) =>
  b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf();

/* ---------- vídeos ---------- */

export async function getVideos(): Promise<Video[]> {
  const all = await getCollection('videos', isPublished);
  return all.sort(byDateDesc);
}

export async function getEpisodes(): Promise<Video[]> {
  return (await getVideos()).filter((v) => v.data.format === 'longo');
}

export async function getCuts(): Promise<Video[]> {
  return (await getVideos()).filter((v) => v.data.format === 'corte');
}

export async function getFeaturedEpisodes(limit = 3): Promise<Video[]> {
  const episodes = await getEpisodes();
  const featured = episodes.filter((v) => v.data.featured);
  return (featured.length ? featured : episodes).slice(0, limit);
}

export async function getLatestEpisode(): Promise<Video | undefined> {
  return (await getEpisodes())[0];
}

export async function getCutsOf(episode: Video): Promise<Video[]> {
  return (await getCuts()).filter((cut) => cut.data.parent?.id === episode.id);
}

/* ---------- análises ---------- */

export async function getArticles(): Promise<Article[]> {
  const all = await getCollection('analises', isPublished);
  return all.sort(byDateDesc);
}

/** Destaque primeiro, depois as mais recentes. */
export async function getHomeArticles(limit = 4): Promise<Article[]> {
  const articles = await getArticles();
  const lead = articles.find((a) => a.data.featured) ?? articles[0];
  if (!lead) return [];
  return [lead, ...articles.filter((a) => a.id !== lead.id)].slice(0, limit);
}

/* ---------- temas ---------- */

export async function getTemas(): Promise<Tema[]> {
  const temas = await getCollection('temas');
  return temas.sort((a, b) => a.data.order - b.data.order);
}

export async function getTema(id: string): Promise<Tema> {
  const tema = await getEntry('temas', id);
  if (!tema) throw new Error(`Tema não encontrado: ${id}`);
  return tema;
}

export async function getContentByTema(temaId: string) {
  const [videos, articles] = await Promise.all([getVideos(), getArticles()]);
  return {
    episodes: videos.filter((v) => v.data.tema.id === temaId && v.data.format === 'longo'),
    cuts: videos.filter((v) => v.data.tema.id === temaId && v.data.format === 'corte'),
    articles: articles.filter((a) => a.data.tema.id === temaId),
  };
}

/** Quantidade de publicações por tema, para índices e contadores. */
export async function getTemaCounts(): Promise<Map<string, number>> {
  const [videos, articles] = await Promise.all([getVideos(), getArticles()]);
  const counts = new Map<string, number>();
  for (const item of [...videos, ...articles]) {
    const id = item.data.tema.id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/* ---------- rotas ---------- */

export const routes = {
  video: (entry: Video) => `/videos/${entry.id}`,
  article: (entry: Article) => `/analises/${entry.id}`,
  tema: (id: string) => `/temas/${id}`,
} as const;
