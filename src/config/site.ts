/**
 * Configuração central da marca e do site.
 * Textos institucionais seguem o Manual de Marca v1.0 (docs/brand).
 */

export const site = {
  name: 'MARGEM',
  url: 'https://margem.com.br',
  locale: 'pt-BR',
  signature: ['Política', 'Economia', 'Pessoas'],
  tagline: 'Outro ponto de vista é possível.',
  description:
    'Política, economia e vida cotidiana com dados, contexto e olhar humano. Análises para além do óbvio.',
  positioning:
    'Análise crítica do Brasil real: política, economia e sociedade com contexto, dados e olhar humano.',
  shortDescription: 'Um espaço editorial sobre trabalho, renda, cidade, democracia e cotidiano.',
  motto: 'Humano antes do efeito. Contexto antes do ruído. A vida real antes da estética.',
} as const;

export const hero = {
  headline: 'O que os números\n[não contam]',
  subheadline: 'Análises para além do óbvio.',
  stack: ['Trabalho', 'Cidade', 'Renda', 'Democracia', 'Vida real'],
} as const;

export const keyPhrases = [
  'A vida real também é política.',
  'O que os números não contam.',
  'Economia é gente.',
  'Realidade contra discurso.',
  'Da margem também se constrói um país.',
  'Mesmas pessoas. Outras perguntas.',
  'Política começa na vida real.',
] as const;

export type NavItem = { label: string; href: string };

export const primaryNav: NavItem[] = [
  { label: 'Vídeos', href: '/videos' },
  { label: 'Temas', href: '/temas' },
  { label: 'Dados', href: '/dados' },
  { label: 'Análises', href: '/analises' },
  { label: 'Manifesto', href: '/manifesto' },
  { label: 'Sobre', href: '/sobre' },
];

export type SocialChannel = {
  id: 'youtube' | 'instagram' | 'tiktok';
  label: string;
  href: string;
  description: string;
};

export const socials: SocialChannel[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/channel/UCiuYaTHW5WLhCbAN86v4PRw',
    description:
      'Política, economia e pessoas. Análises críticas do Brasil real, com contexto, dados e olhar humano.',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/canalmargem',
    description:
      'Política, economia e vida real. Cortes, análises e ideias para entender o Brasil além do óbvio.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    href: 'https://www.tiktok.com/@canalmargem',
    description:
      'Política, economia e vida real. Cortes, análises e ideias para entender o Brasil além do óbvio.',
  },
];

export const contact = {
  email: 'contato.canalmargem@gmail.com',
} as const;

/** CTAs aprovados pelo manual (seção 16). */
export const ctas = {
  watch: 'Assista ao vídeo completo',
  save: 'Salve para rever',
  send: 'Envie para quem precisa ver isso',
  comment: 'Comente sua leitura',
  share: 'Compartilhe com contexto',
  read: 'Veja a análise completa',
} as const;
