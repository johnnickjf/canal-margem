/**
 * Banco de imagens do site.
 *
 * Todo conteúdo referencia fotos por chave (`cover: metro-interior`), nunca por URL.
 * Para trocar uma foto por material próprio, basta alterar `src` aqui — por exemplo
 * para `/images/metro-interior.jpg` dentro de `public/`.
 *
 * Fotos atuais: Unsplash (licença Unsplash, uso livre). Crédito exibido no site.
 */

export type Photo = {
  src: string;
  alt: string;
  credit: string;
  /** Link para a página do autor ou da foto original. */
  creditUrl?: string;
  /** Ponto focal (CSS object-position) para recortes. */
  focus?: string;
};

const unsplash = (id: string) => `https://images.unsplash.com/${id}`;

export const photos = {
  'metro-interior': {
    src: unsplash('photo-1570018490900-6983c72ded22'),
    alt: 'Passageiros apertados dentro de um vagão de metrô, um deles segura a barra de apoio',
    credit: 'Heron Rossato',
    creditUrl: 'https://unsplash.com/@heronrossato',
    focus: '50% 40%',
  },
  'estacao-lotada': {
    src: unsplash('photo-1635509644020-cadfe77e8040'),
    alt: 'Plataforma de trem tomada por uma multidão de passageiros ao lado de um trem parado',
    credit: 'Ray Alves',
    creditUrl: 'https://unsplash.com/@rayalvessouza_',
    focus: '50% 50%',
  },
  'vagao-trem': {
    src: unsplash('photo-1605367177286-f3d4789c47a0'),
    alt: 'Passageiros de máscara em pé e sentados no corredor de um trem metropolitano',
    credit: 'Dennis Siqueira',
    creditUrl: 'https://unsplash.com/@densiq',
  },
  'ponto-onibus-chuva': {
    src: unsplash('photo-1700677002203-4f6211b9250c'),
    alt: 'Vista do alto de um ponto de ônibus lotado em dia de chuva, com dezenas de guarda-chuvas abertos',
    credit: 'Gustavo Nacht',
    creditUrl: 'https://unsplash.com/@gnacht',
  },
  'avenida-paulista': {
    src: unsplash('photo-1572894234976-d961418c709d'),
    alt: 'Vista aérea de uma avenida larga cercada de prédios altos em São Paulo',
    credit: 'Bianca Monteiro',
    creditUrl: 'https://unsplash.com/@biancafmonteiro',
  },
  'multidao-rua': {
    src: unsplash('photo-1732494664037-5bbeda7d579d'),
    alt: 'Pessoas caminhando em uma rua movimentada do centro, entre prédios altos',
    credit: 'Darwin Boaventura',
    creditUrl: 'https://unsplash.com/@darwinboaventura',
  },
  'retrato-chapeu': {
    src: unsplash('photo-1503164412421-0512323df4e7'),
    alt: 'Retrato em preto e branco de um homem idoso de chapéu, olhando para a câmera',
    credit: 'Angelo Sartori',
    creditUrl: 'https://unsplash.com/@angelosartori',
    focus: '50% 30%',
  },
  'fachada-trabalho': {
    src: unsplash('photo-1565118387387-add70a563efe'),
    alt: 'Trabalhador suspenso em uma plataforma na fachada de um prédio alto',
    credit: 'Guilherme Cunha',
    creditUrl: 'https://unsplash.com/@guiccunha',
  },
  obra: {
    src: unsplash('photo-1489514354504-1653aa90e34e'),
    alt: 'Operário de uniforme laranja caminhando sobre a estrutura de uma laje em construção',
    credit: 'Guilherme Cunha',
    creditUrl: 'https://unsplash.com/@guiccunha',
  },
  maos: {
    src: unsplash('photo-1499152701974-8a37869fea68'),
    alt: 'Mãos calejadas abertas, com as palmas voltadas para cima, em preto e branco',
    credit: 'Om Prakash Sethia',
    creditUrl: 'https://unsplash.com/@om_07',
  },
  'feira-peixe': {
    src: unsplash('photo-1750601455084-6099277a6817'),
    alt: 'Vendedor de chapéu limpando peixes sobre uma bancada de madeira em um mercado',
    credit: 'Paulo Mateus Oliveira Guerra',
    creditUrl: 'https://unsplash.com/@paulomateus',
  },
  'mercado-paulista': {
    src: unsplash('photo-1774127421469-1bc575001f9c'),
    alt: 'Vista do alto de um mercado em São Paulo, com bancas e pessoas no corredor',
    credit: 'Willian Reis',
    creditUrl:
      'https://unsplash.com/photos/bustling-indoor-market-with-stalls-and-shoppers-j8deK7ZkIOU',
  },
  'onibus-centro': {
    src: unsplash('photo-1638280459638-c1186f39af32'),
    alt: 'Ônibus atravessa um cruzamento cercado por edifícios no centro de São Paulo',
    credit: 'Bianca Neves',
    creditUrl:
      'https://unsplash.com/photos/a-red-bus-driving-down-a-street-next-to-tall-buildings-mVBNdc1dKX0',
    focus: '50% 70%',
  },
  'morro-casas': {
    src: unsplash('photo-1545692770-f0029a91f3ba'),
    alt: 'Casas de alvenaria sem reboco empilhadas na encosta de um morro',
    credit: 'Dee Sid',
    creditUrl: 'https://unsplash.com/@deesid',
  },
  'vendedor-rua': {
    src: unsplash('photo-1725287958846-ea502ce60cb2'),
    alt: 'Pessoas em volta de um carrinho de comida de rua em uma calçada',
    credit: 'Darwin Boaventura',
    creditUrl: 'https://unsplash.com/@darwinboaventura',
  },
  'motorista-onibus': {
    src: unsplash('photo-1570299135572-3a10aa26de2d'),
    alt: 'Motorista de ônibus ao volante, visto de trás, durante o trajeto',
    credit: 'Heron Rossato',
    creditUrl: 'https://unsplash.com/@heronrossato',
  },
  'trabalhador-retrato': {
    src: unsplash('photo-1770471464243-b45fc9de384b'),
    alt: 'Homem de boné e camiseta sorrindo de lado, ao ar livre',
    credit: 'Marcelo Magalhães',
    creditUrl: 'https://unsplash.com/@marcelomagalhaes',
    focus: '40% 35%',
  },
  transito: {
    src: unsplash('photo-1700680010066-f02c3e31d9e5'),
    alt: 'Rua estreita congestionada de carros entre edifícios altos, vista de cima',
    credit: 'Gustavo Nacht',
    creditUrl: 'https://unsplash.com/@gnacht',
  },
  'loterica-noite': {
    src: unsplash('photo-1779372554920-e9f6c12eb811'),
    alt: 'Mulher passa em frente a uma casa lotérica iluminada à noite',
    credit: 'Darwin Boaventura',
    creditUrl: 'https://unsplash.com/@darwinboaventura',
  },
  'faixa-pedestre': {
    src: unsplash('photo-1494331390069-dc208a0de112'),
    alt: 'Pessoa atravessando uma faixa de pedestres vazia, em preto e branco',
    credit: 'Davidson Luna',
    creditUrl: 'https://unsplash.com/@davidsonluna',
  },
  'escada-metro': {
    src: unsplash('photo-1735074850922-408e8e9ae4c7'),
    alt: 'Escada rolante de uma estação de metrô com paredes de azulejo',
    credit: 'Darwin Boaventura',
    creditUrl: 'https://unsplash.com/@darwinboaventura',
  },
  'sombras-calcada': {
    src: unsplash('photo-1747683334388-7af4a1822fcf'),
    alt: 'Duas pessoas caminham por uma calçada cortada por sol e sombra',
    credit: 'Darwin Boaventura',
    creditUrl: 'https://unsplash.com/@darwinboaventura',
  },
} as const satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof photos;

export const photoKeys = Object.keys(photos) as [PhotoKey, ...PhotoKey[]];

export function getPhoto(key: PhotoKey): Photo {
  return photos[key];
}

/** Gera URL redimensionada quando a origem suporta parâmetros (Unsplash). */
export function photoUrl(photo: Photo, width: number, height?: number): string {
  if (!photo.src.startsWith('https://images.unsplash.com/')) return photo.src;
  const params = new URLSearchParams({
    w: String(width),
    q: '72',
    auto: 'format',
    fit: 'crop',
  });
  if (height) params.set('h', String(height));
  return `${photo.src}?${params}`;
}
