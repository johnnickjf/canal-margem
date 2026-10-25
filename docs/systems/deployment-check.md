# Verificação pós-publicação — fase 24

## Entrega e estado

O comando `pnpm deployment:check` verifica um site já publicado e, opcionalmente, a API Margem.
Ele transforma em checagens repetíveis parte dos requisitos de SEO e disponibilidade registrados
em [AGENTS.md](../../AGENTS.md) e nos [ADRs de hospedagem e cache](../adr/0005-hosting-and-portability.md).
O comando não publica serviços nem escolhe um provedor. A hospedagem do frontend, Railway, R2,
alertas remotos e indexação externa continuam dependendo da implantação e de acesso aos ambientes.

## Uso

Depois de gerar e publicar `dist/`, informe a origem canônica do site:

```bash
pnpm deployment:check --site https://margem.com.br
```

Para verificar também a API, informe sua origem sem caminho:

```bash
pnpm deployment:check --site https://margem.com.br --api https://api.margem.com.br
```

`MARGEM_SITE_URL` e `MARGEM_API_URL` podem fornecer os mesmos valores pelo ambiente. HTTPS é
obrigatório, exceto para `localhost` e endereços de loopback durante a validação local. O comando
não segue redirecionamentos: use o hostname canônico, sem caminho, query ou fragmento.

## Checagens do site

O comando lê `robots.txt`, encontra suas diretivas `Sitemap`, percorre índices e arquivos de
sitemap e solicita cada URL listada. Rejeita destinos de outra origem, páginas repetidas no
sitemap e respostas que redirecionam ou não retornam 2xx. Confere se o grupo `User-agent: *`
permite rastrear as URLs públicas listadas.

Em cada página, valida título, descrição, URL canônica, Open Graph e Twitter Cards; confere um
único `h1` com texto e conteúdo em `<main>` no HTML recebido; rejeita `noindex` em metadados HTML
ou no cabeçalho `X-Robots-Tag` e valida a sintaxe de blocos JSON-LD presentes. Isso observa a
resposta pública renderizada pelo servidor, sem executar JavaScript no navegador.

## Checagens da API

Quando `--api` é informado, o comando solicita `/healthz`, `/readyz` e
`/api/v1/publications/current`. Além dos status HTTP, valida que a resposta da publicação atual
contém geração, ID SHA-256 e data de ativação válidos. `readyz` exige uma edição ativa.

## Limites

O comando limita a verificação a 100 arquivos de sitemap, 5.000 páginas, oito solicitações
simultâneas e dez segundos por solicitação. Qualquer falha retorna código diferente de zero;
`--help` não faz requisições, e argumentos inválidos retornam código 2.

Uma execução bem-sucedida comprova apenas as respostas observadas naquele momento. Não comprova
indexação em buscadores, disponibilidade futura, políticas de cache/CDN, CORS do R2, desempenho,
fidelidade editorial ou configuração de alertas. Esses itens ainda exigem implantação e
verificação operacional próprias. A regra permanente de SEO e descoberta por IA continua valendo
para as páginas públicas.
