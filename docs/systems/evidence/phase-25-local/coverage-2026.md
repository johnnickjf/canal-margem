# Ampliação local de dados — 27/10/2026

A edição local de geração 6 foi preparada com 1.292 recortes e ativada com base na geração 5.
Os [manifestos de seleção](publication-2026.json) e [ativação](activation-2026.json) fixam a
edição e seus IDs. Ela mantém as ressalvas e os recortes anuais descritos na
[cobertura anterior](coverage.md); não é publicação externa.

As coletas reais entre 01/01 e 27/10/2026 aceitaram:

| Fonte | Lote | Observações | Períodos disponíveis selecionados |
|---|---|---:|---|
| IBGE | `04db9cd1490f042e6dc99ae8e09309051aa31b1fd23e84ff6cd09e3aba1de465` | 75 | Desemprego e informalidade até junho; IPCA, alimentação e INPC até setembro. |
| BCB | `a89484be50b15b72014b47634d0d18036b2e18fb12d09990bb8113121c5e4259` | 24 | Mínimo nominal até setembro; comprometimento da renda até julho. |
| ANP | `aa2084e5585cd2ce50ab04ea0f02f9439274de5c23ebeb171ff5d6feace16e58` | 42 | Gasolina, semanas de 04/01 a 24/10. |
| Conab/DIEESE | `b64db4696a688e7d1dc22065ed10d1f27b0a563d59593a3eb471dfce427ef391` | 243 | Cesta das 27 capitais, janeiro a setembro. |

As quantidades são do lote, não necessariamente todas da seleção pública. As datas são de
referência e não indicam divulgação ou coleta. Os [252 pedidos de cálculo](calculations-2026.json)
usam nove mínimos e nove índices INPC de 2026, índice-base de dezembro/2025 e 243 cestas do
mesmo mês e capital; os nove resultados TR2 e os 243 CV5 retornaram `observed`. Não se substituiu
um mês ausente de uma fonte pelo de outra.

Na geração 6, foram conferidos por SHA-256 os 53 objetos raw distintos vinculados às
observações selecionadas. O build fixado nessa edição gerou 89 páginas: as 15 páginas dos
indicadores principais identificam a edição, 14 exibem valores e TR1 permanece indisponível.
Por exemplo, o HTML mostra gasolina de 18 a 24/10/2026 por R$ 6,49/litro, desemprego do
segundo trimestre de 2026 em 5,4% e comprometimento da renda de julho/2026 em 27,75%.

Após essas coletas, `monitor` ainda retornou `unhealthy` e código 1 por ausência das duas
séries históricas CV2 anteriores a 2020. A coleta IBGE de 2012–2019 aceitou 873 observações,
incluindo essas séries; uma nova execução do monitor retornou `healthy` e código 0 para as
cinco fontes. A cobertura histórica obtida nessa última coleta não foi adicionada
automaticamente à edição pública. O resultado é uma medição local no instante da execução,
segundo os limites configurados: não prova que haja scheduler ativo, envio de alerta,
integridade integral do raw ou operação remota. Não havia webhook configurado; o resultado
indicou `scheduler_exit_status`, sem prova de que algum scheduler tenha recebido o código.

Em ensaio independente, um receptor HTTPS na própria máquina recebeu `resolved` para a base
saudável e `firing` para a cópia anterior com fontes atrasadas, com a mesma chave de deduplicação.
O monitor retornou respectivamente 0 e 1. Quando o receptor de teste respondeu HTTP 500, o
monitor retornou 1 e registrou a recusa. O certificado de teste foi confiado somente pelo
processo do ensaio; não há webhook remoto, scheduler ou notificação operacional configurados.

Na suíte Go com PostgreSQL e LocalStack isolados, uma falha mostrou que requisições HEAD eram
rejeitadas pelo roteador antes da conversão para GET. A guarda foi movida para antes da seleção
da rota. Os testes de API e a suíte backend com `-race` passaram; uma API local executando o
código corrigido retornou HEAD 200 na publicação corrente, 404 em rota ausente e 405 na
calculadora. O processo da API original, já iniciado antes da alteração, precisa ser reiniciado
para usar o código corrigido.
