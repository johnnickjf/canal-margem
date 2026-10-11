import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { photoKeys } from './data/photos';

const photo = z.enum(photoKeys);

const source = z.object({
  label: z.string(),
  url: z.url().optional(),
});

/**
 * Títulos aceitam um trecho entre colchetes para receber o destaque em vermelho:
 *   title: "O preço do [aluguel]"
 * O manual pede 2–5 palavras e no máximo um destaque por título.
 */
const headline = z
  .string()
  .min(2)
  .refine((value) => (value.match(/\[/g) ?? []).length <= 1, {
    message: 'Use no máximo um trecho destacado entre [colchetes].',
  });

/** Pilares editoriais (manual, seção 12). */
const temas = defineCollection({
  loader: file('src/content/temas.json'),
  schema: z.object({
    order: z.number().int().positive(),
    name: z.string(),
    question: z.string(),
    summary: z.string(),
    cover: photo,
  }),
});

/** Episódios longos (16:9) e cortes (9:16) compartilham a mesma numeração M / 000. */
const videos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/videos' }),
  schema: z
    .object({
      episode: z.number().int().positive(),
      format: z.enum(['longo', 'corte']),
      title: headline,
      dek: z.string(),
      tema: reference('temas'),
      publishedAt: z.coerce.date(),
      duration: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/),
      cover: photo,
      youtubeId: z.string().optional(),
      featured: z.boolean().default(false),
      chapters: z.array(z.object({ time: z.string(), label: z.string() })).default([]),
      sources: z.array(source).default([]),
      /** Cortes apontam para o episódio de origem. */
      parent: reference('videos').optional(),
      draft: z.boolean().default(false),
    })
    .refine((data) => data.format === 'longo' || data.parent, {
      message: 'Cortes precisam indicar o episódio de origem em `parent`.',
      path: ['parent'],
    }),
});

const analises = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/analises' }),
  schema: z.object({
    title: headline,
    dek: z.string(),
    author: z.string(),
    tema: reference('temas'),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    cover: photo,
    episode: reference('videos').optional(),
    featured: z.boolean().default(false),
    sources: z.array(source).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { temas, videos, analises };
