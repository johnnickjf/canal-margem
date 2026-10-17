# ADR-0004 — Recuperação por backup nativo e reconstrução

- Status: aceito para implementação; backup e reconstrução ainda não ensaiados.
- Data: 17/10/2026.
- Escopo: retenção operacional e recuperação dos dados públicos tratados pelo MVP.

## Contexto

O MVP coleta dados de fontes públicas, normaliza séries, calcula indicadores e publica
projeções. Não há login nem histórico pessoal de usuários a recuperar. O custo de refazer
a coleta e o processamento orienta a proteção necessária. Essa reconstrução ainda não foi
medida para todas as fontes; acesso e histórico disponíveis variam por provedor.

A imutabilidade de observações e publicações protege a consistência durante a operação.
Ela não exige prometer recuperação de toda versão antiga após perda da infraestrutura.
A fonte pode revisar ou retirar dados: reconstruir a base não garante recuperar os mesmos
bytes ou valores que foram apresentados anteriormente.

## Alternativas

| Alternativa | Consequência |
|---|---|
| Somente reconstruir | Menos operação de backup; todo erro no banco pode exigir nova coleta e processamento |
| Backup nativo Railway + reconstrução | Facilita desfazer erros comuns no banco; perda do projeto ou dos objetos ainda pode exigir reconstrução |
| Backup independente de banco e objetos | Preserva mais evidências após perda dos fornecedores, mas acrescenta credenciais, cópias, retenção e ensaios sem necessidade demonstrada no MVP |
| WAL/PITR e alta disponibilidade | Reduzem certas perdas e interrupções; o produto ainda não exige essa operação |

## Decisão

Usar backup diário nativo do volume PostgreSQL na Railway como conveniência de recuperação.
A documentação consultada informa execução a cada 24 horas e retenção de seis dias.
Configurar e testar a restauração na implantação; habilitar um agendamento não comprova
que o banco e as publicações voltam a funcionar.

Manter código, migrações, definições de fontes/catálogo, fórmulas, métodos e configuração
sem segredos no Git, com os elementos necessários para repovoar o sistema. Preservar raw no
R2 para reprocessamento enquanto disponível. Dados normalizados, derivadas e JSONs publicados
podem ser reconstruídos pelos pipelines, conforme as fontes e evidências que restarem.
Um objeto raw isolado só pode ser reutilizado se houver proveniência e metadados suficientes
para interpretá-lo; o hash dos bytes não recupera sozinho esses vínculos.

Não contratar Backblaze B2 nem manter uma cópia independente integral no MVP. Não exigir
dumps diários externos, manifesto conjunto de backup, rotação de cópias em outro fornecedor
ou ensaio mensal de recuperação completa. O rascunho anterior desta mesma entrega foi
revisto antes de implantação; nenhum backup ou objeto existente é removido por esta decisão.

Não adotar RPO/RTO fixos neste estágio. O intervalo de backup nativo não garante uma perda
máxima nem um prazo de retorno. Medir o tempo de restaurar o banco e de reconstruir o recorte
do MVP, incluindo fontes indisponíveis e limites de acesso, antes de assumir esses compromissos.

## Retenção e limites do histórico

Na operação normal, preservar observações aceitas, recibos, métodos, raw e seleções de
publicações retidas. Revisões acrescentam registros; não sobrescrever valores anteriores.
Limpeza não pode romper uma publicação acessível ou liberar uma duplicação de efeito.
A revisão inicial de crescimento é mensal; não há limpeza automática implementada.

Os prazos já definidos para candidatos de limpeza continuam mínimos operacionais:
staging/candidatos nunca ativados após 30 dias; eventos e raw de falhas sem dependências,
e objetos órfãos, após 90 dias. Antes de excluir, conferir referências e jobs em andamento
com proteção contra corridas. O lock R2 do ADR-0002 continua retendo o prefixo raw; não
remover essa proteção apenas para limpar arquivos. Nenhuma exclusão faz parte desta entrega.

Após perda da base ou dos objetos, aceitar perder capturas, recibos, ativações e versões
que não possam ser recuperados. Consultas históricas ficam limitadas ao histórico sobrevivente.
Uma nova coleta identifica a captura e a aceitação reais, sem inventar a primeira coleta,
a ordem de edições ou um evento perdido. Reconstrução cria nova publicação; não reutiliza
um ID/URL antigo para conteúdo diferente nem redireciona silenciosamente uma leitura fixada.

Se uma fonte estiver indisponível ou não oferecer o histórico necessário, declarar a lacuna
e aplicar a política de publicação do catálogo. Não preencher dados perdidos com zero ou
apresentar uma edição atual como se fosse a edição antiga. Essa limitação é aceita no MVP.

## Consequências

Backups nativos não abrangem os buckets R2. A recuperação do volume fica no mesmo projeto
e ambiente Railway; apagar o volume também apaga seus backups, segundo o provedor.
R2 não substitui backup do banco, pois os vínculos e eventos ficam no PostgreSQL.
A arquitetura admite indisponibilidade durante a reconstrução e perda de reprodução exata
de publicações antigas após desastre. A série histórica hoje oferecida pela fonte ainda
pode ser coletada, mas não equivale às versões que o Margem havia observado.

Reavaliar backup independente se a reconstrução medida for cara ou demorada para a operação,
se houver dados próprios insubstituíveis ou se o produto assumir preservação de versões
como compromisso. Essas condições não são requisitos atuais.

## Evidências e validação

Fontes oficiais consultadas em 17/10/2026: [backups de volumes Railway](https://docs.railway.com/volumes/backups)
e [recuperação de PostgreSQL](https://docs.railway.com/guides/postgres-backups-restores).
O [procedimento de recuperação](../systems/storage.md#restauração-planejada) distingue
restaurar um backup nativo e reconstruir uma base a partir das evidências disponíveis.
A implantação deve testar ambos, verificar dependências, registrar perdas e medir duração.
Nenhuma restauração remota ou reconstrução completa foi executada nesta revisão documental.
