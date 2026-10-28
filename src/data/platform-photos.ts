import type { PhotoKey } from './photos';

/** Fotografias editoriais por dimensão, compartilhadas entre temas e indicadores. */
export const platformPhotos: Record<string, PhotoKey> = {
  'trabalho-e-renda': 'fachada-trabalho',
  'custo-de-vida': 'mercado-paulista',
  'vida-financeira': 'loterica-noite',
  'qualidade-de-vida': 'morro-casas',
  'economia-e-estado': 'onibus-centro',
};
