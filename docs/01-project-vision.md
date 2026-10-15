# Margem — Visão e Fundamentos do Projeto

Este documento define o produto a desenvolver. O [frontend atual](systems/frontend.md) ainda é editorial. Os valores numéricos dos exemplos são ilustrativos.

## 1. Visão

O Margem será uma plataforma de análise socioeconômica voltada a transformar dados econômicos, sociais e políticos complexos em informações compreensíveis sobre condições materiais de vida.

O objetivo central não é apresentar indicadores isolados, nem dizer ao usuário em quem votar.

A plataforma deve permitir responder perguntas como:

- Estou trabalhando mais ou menos?
- Minha hora de trabalho vale mais ou menos?
- Meu salário compra mais ou menos comida?
- Moradia ficou proporcionalmente mais cara?
- Quanto da renda das famílias está comprometido com dívidas?
- A pobreza aumentou ou diminuiu?
- A desigualdade aumentou ou diminuiu?
- Serviços e condições sociais melhoraram?
- Uma determinada política pública teve quais consequências mensuráveis?
- Diferentes períodos históricos produziram quais resultados materiais?

A proposta é conectar política, economia e qualidade de vida por meio de evidências verificáveis.

---

## 2. Problema

Discussões econômicas e políticas normalmente apresentam pelo menos três dificuldades.

### Excesso de informação

Existem dezenas de indicadores relevantes, muitas vezes apresentados simultaneamente, dificultando a interpretação por pessoas sem formação específica.

### Indicadores sem contexto

PIB, inflação, dívida pública, déficit, desemprego e outros indicadores são frequentemente apresentados isoladamente.

Um país pode apresentar crescimento do PIB enquanto parte relevante da população enfrenta redução de renda real, maior endividamento ou aumento do custo de vida.

### Linguagem técnica

Muitos conceitos necessários para compreender economia política exigem conhecimento prévio.

Termos como:

- renda real;
- resultado primário;
- dívida bruta;
- produtividade;
- comprometimento de renda;
- política monetária;
- política fiscal;

não são necessariamente intuitivos.

O resultado é uma barreira de entrada que favorece interpretações simplificadas ou puramente retóricas.

---

## 3. Princípio central

A plataforma deve partir da vida material das pessoas e só depois apresentar os conceitos econômicos relacionados.

O fluxo conceitual será:

> pergunta → resposta simples → evidência → explicação → metodologia

Nunca:

> dataset → gráfico → terminologia técnica → interpretação deixada ao usuário

---

## 4. O que o Margem não pretende ser

O Margem não deve ser:

- um portal genérico de dados;
- um agregador de notícias;
- um dashboard financeiro;
- uma ferramenta de propaganda partidária;
- uma ferramenta que transforma um único indicador em avaliação de governo;
- uma ferramenta que trata correlação temporal como causalidade;
- uma plataforma que exige conhecimento econômico para ser utilizada.

---

## 5. Unidade de análise

A principal unidade conceitual do sistema não será o partido político nem o governo.

Será a política pública.

Exemplos:

- política de valorização do salário mínimo;
- austeridade fiscal;
- transferências de renda;
- privatização;
- política industrial;
- liberalização comercial;
- reforma trabalhista;
- reforma previdenciária;
- tributação sobre consumo;
- tributação sobre renda;
- investimento público;
- política de combustíveis;
- expansão ou redução de serviços públicos.

Posteriormente essas políticas podem ser associadas aos governos, coalizões e partidos que as implementaram ou apoiaram.

Isso permite distinguir:

> governo → política implementada → mecanismo esperado → indicadores afetados → resultados observados

---

## 6. Dimensões socioeconômicas

Os indicadores inicialmente levantados serão agrupados em cinco dimensões compreensíveis.

### Trabalho e renda

Pergunta central:

> Estou trabalhando mais e sendo melhor remunerado?

Possíveis indicadores:

- rendimento real;
- rendimento real por hora;
- salário mínimo real;
- horas trabalhadas;
- desemprego;
- informalidade;
- vínculo formal;
- contribuição previdenciária.

### Custo de vida

Pergunta central:

> Quanto do meu trabalho é necessário para sustentar minha vida?

Possíveis indicadores:

- alimentação;
- cesta básica;
- aluguel;
- habitação;
- energia;
- gasolina;
- transporte;
- inflação por grupo de consumo.

### Vida financeira

Pergunta central:

> Quanto da renda está sendo transferido para dívidas e juros?

Possíveis indicadores:

- endividamento das famílias;
- comprometimento da renda;
- juros;
- disponibilidade de crédito;
- inadimplência.

### Qualidade de vida

Pergunta central:

> As condições materiais da população estão melhorando?

Possíveis indicadores:

- pobreza;
- extrema pobreza;
- desigualdade;
- segurança alimentar;
- saneamento;
- educação;
- saúde;
- condições habitacionais.

### Economia e Estado

Pergunta central:

> A estrutura econômica do país está se tornando mais ou menos capaz de sustentar desenvolvimento e bem-estar?

Possíveis indicadores:

- PIB per capita;
- produtividade;
- investimento;
- investimento público;
- dívida pública;
- déficit;
- juros pagos pelo Estado;
- tributação;
- política industrial;
- crédito público.

---

## 7. Tempo de trabalho como unidade material

Uma das hipóteses centrais do produto é utilizar tempo de trabalho como complemento aos valores monetários.

Por exemplo:

> Gasolina: R$ 6,20 por litro

pode ser apresentado também como:

> 18 minutos de trabalho para uma pessoa com determinada renda adquirir um litro.

Da mesma forma:

- cesta básica;
- aluguel;
- energia;
- transporte;
- alimentação;

podem ser relacionados ao tempo necessário de trabalho.

Isso aproxima indicadores econômicos abstratos da experiência cotidiana.

---

## 8. Comparações

A plataforma deverá permitir comparar:

- períodos;
- governos;
- políticas públicas;
- regiões;
- grupos socioeconômicos;
- indicadores.

Uma comparação nunca deve resultar apenas em:

> governo A foi melhor que governo B.

Ela deve apresentar algo como:

> Dos 12 indicadores selecionados, 8 apresentaram melhora, 3 piora e 1 permaneceu estatisticamente estável.

Cada resultado deverá ser individualmente auditável.

---

## 9. Transparência

Todo dado apresentado deverá possuir rastreabilidade.

Sempre que possível, o usuário deverá conseguir descobrir:

- qual é a fonte;
- qual série foi utilizada;
- qual o período;
- quando o dado foi publicado;
- quando foi coletado;
- qual metodologia foi utilizada;
- se houve revisão;
- se existem quebras metodológicas;
- como o indicador derivado foi calculado.

Um princípio importante do projeto é:

> O usuário não precisa confiar no Margem. Ele deve conseguir conferir o Margem.

---

## 10. Fontes

A prioridade será:

1. dados públicos oficiais;
2. documentação oficial;
3. legislação;
4. pesquisas acadêmicas;
5. institutos públicos de pesquisa;
6. organismos internacionais;
7. fontes jornalísticas como contexto.

Notícias não devem ser utilizadas como fonte primária para números quando a informação original estiver disponível.

---

## 11. Objetivo de longo prazo

No futuro, a plataforma poderá oferecer uma ferramenta de avaliação socioeconômica baseada no perfil do usuário.

Em vez de perguntar diretamente:

> Em quem devo votar?

a ferramenta deverá conseguir responder:

> Dadas as suas condições econômicas e prioridades, estas políticas historicamente apresentaram estes efeitos sobre os indicadores que mais afetam você.

A decisão política permanece com o usuário.

---

## 12. Critério de sucesso

O Margem será bem-sucedido quando uma pessoa sem formação econômica conseguir:

1. formular uma pergunta sobre sua realidade;
2. encontrar indicadores relacionados;
3. compreender o que eles significam;
4. comparar períodos ou políticas;
5. verificar as fontes;
6. aprofundar a análise caso queira.

A complexidade deve existir no sistema.

Ela não deve ser imposta ao usuário.
