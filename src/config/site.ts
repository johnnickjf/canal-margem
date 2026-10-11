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
  { label: 'Análises', href: '/analises' },
  { label: 'Manifesto', href: '/manifesto' },
  { label: 'Sobre', href: '/sobre' },
];

export type SocialChannel = {
  id: 'youtube' | 'instagram' | 'tiktok' | 'x' | 'bluesky' | 'linkedin';
  label: string;
  href: string;
  description: string;
};

/** Substitua os `href` pelos perfis oficiais quando estiverem ativos. */
export const socials: SocialChannel[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/@margem',
    description:
      'Política, economia e pessoas. Análises críticas do Brasil real, com contexto, dados e olhar humano.',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/margem',
    description:
      'Política, economia e vida real. Cortes, análises e ideias para entender o Brasil além do óbvio.',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    href: 'https://www.tiktok.com/@margem',
    description:
      'Política, economia e vida real. Cortes, análises e ideias para entender o Brasil além do óbvio.',
  },
  {
    id: 'x',
    label: 'X',
    href: 'https://x.com/margem',
    description:
      'Política, economia, trabalho e vida cotidiana. Dados, contexto e opinião. Outro ponto de vista é possível.',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    href: 'https://bsky.app/profile/margem.com.br',
    description:
      'Política, economia, trabalho e vida cotidiana. Dados, contexto e opinião. Outro ponto de vista é possível.',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/margem',
    description:
      'Economia, trabalho, renda, tecnologia e política vistas pela vida real. Análises com contexto, dados e perspectiva humana.',
  },
];

export const contact = {
  email: 'contato@margem.com.br',
  pautas: 'pautas@margem.com.br',
} as const;

/**
 * Newsletter: aponte `action` para o endpoint do provedor (Buttondown, Substack,
 * Mailchimp, formulário próprio). Enquanto estiver vazio, o formulário informa
 * que as inscrições ainda não estão abertas, sem enviar dados a lugar nenhum.
 */
export const newsletter = {
  action: '',
  method: 'post',
  fieldName: 'email',
  title: 'Uma carta [por semana]',
  pitch:
    'Toda sexta, o que importou na semana em política e economia — com contexto, sem barulho. Leitura de cinco minutos.',
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
