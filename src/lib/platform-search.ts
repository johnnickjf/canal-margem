import { concepts } from '@/data/concepts';
import { evidenceCatalog } from '@/data/evidence';
import { policies } from '@/data/policies';
import { conceptAliases, indicatorAliases } from '@/data/search-aliases';
import { evidenceClasses } from './evidence-catalog';
import type { Platform } from './platform-build';
import type { SearchItem } from './search';

/** Definições da edição do build; não indexa números nem presume cobertura de dados. */
export function platformSearchItems(platform: Platform): SearchItem[] {
  const themes = new Map(platform.themes.map((theme) => [theme.slug, theme.name]));
  return [
    ...evidenceCatalog.studies.map((study) => ({
      type: 'Estudo' as const,
      title: study.title,
      text: `${study.question} ${study.method} ${study.finding} ${study.authors.join(' ')}`,
      url: `/evidencias/${study.id}`,
      meta: `${study.year} / ${evidenceClasses[study.assessment.classification]}`,
    })),
    ...policies.map((policy) => ({
      type: 'Política' as const,
      title: policy.name,
      text: `${policy.description} ${policy.affected_indicators.map((item) => item.note).join(' ')}`,
      url: `/politicas/${policy.id}`,
      meta: 'Política federal / Contexto temporal sem causalidade estimada',
    })),
    ...platform.indicators.map((indicator) => ({
      type: 'Indicador' as const,
      title: indicator.name,
      text: `${indicator.question} ${indicator.definition}`,
      aliases: indicatorAliases[indicator.slug] ?? [],
      url: `/indicador/${indicator.slug}`,
      meta: [
        themes.get(indicator.theme),
        indicator.role === 'primary' ? 'Indicador principal' : 'Medida auxiliar',
      ].join(' / '),
    })),
    ...platform.themes.map((theme) => ({
      type: 'Tema' as const,
      title: theme.name,
      text: theme.question,
      url: `/tema/${theme.slug}`,
      meta: 'Tema socioeconômico',
    })),
    ...concepts.map((concept) => ({
      type: 'Entenda' as const,
      title: concept.title,
      text: `${concept.question} ${concept.definition}`,
      aliases: conceptAliases[concept.slug] ?? [],
      url: `/entenda/${concept.slug}`,
      meta: `Conceito econômico / ${concept.question}`,
    })),
    {
      type: 'Entenda' as const,
      title: 'Como ler os dados',
      text: 'Períodos, recortes, fontes, metodologia, revisões e dados indisponíveis.',
      url: '/entenda/como-ler-os-dados',
      meta: 'Guia de leitura',
    },
  ];
}
