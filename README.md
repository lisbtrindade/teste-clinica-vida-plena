# Clínica Vida Plena — Sistema de Agendamentos

Projeto baseado no desafio técnico da Clínica Vida Plena.

## Stack

- Backend: Node.js + TypeScript + Express + Mongoose
- Banco: MongoDB
- Frontend: React + TypeScript + Vite
- Infraestrutura: Docker Compose
- Testes: Vitest
- Validação: Zod

## Como executar

Os arquivos de teste em `./data` são fictícios e podem ser versionados. Para usar outros dados, coloque-os nessa pasta antes de executar:

- `agendamentos.csv`
- `medicos.json`

Depois:

```bash
docker compose up --build
```

Frontend: http://localhost:5173  
API: http://localhost:3000/health

## Importação

Dentro do container do backend:

```bash
docker compose exec backend npm run import
```

O comando:

1. lê CSV e JSON;
2. normaliza status, tipo de atendimento, datas e telefones;
3. identifica registros duplicados e conflitos;
4. valida médico, paciente, horário e formato;
5. importa somente registros válidos;
6. imprime um relatório de importados, corrigidos e descartados.

## Decisões

### 1. Cancelamento em cima da hora

Adotei **24 horas** como limite. Cancelamentos com menos de 24 horas são marcados como `cancelada_paciente` e entram também em um indicador separado de cancelamento tardio. Não são transformados automaticamente em falta, porque são eventos diferentes no histórico.

### 2. Cancelamentos na taxa de falta

A taxa principal considera apenas consultas com desfecho `realizada` ou `falta`:

`faltas / (faltas + realizadas)`

Isso evita que uma consulta cancelada seja tratada como se tivesse chegado ao horário e gerado um no-show.

### 3. Primeira consulta

"Primeira consulta" significa **primeira vez do paciente na clínica**, independentemente do médico. O histórico é ordenado pela data da consulta e a primeira consulta válida do paciente recebe esse indicador.

### 4. Duplicados e conflitos

O `id` do agendamento é a chave de negócio. Para linhas repetidas com o mesmo conteúdo, a primeira ocorrência é mantida. Para o mesmo `id` com dados diferentes, a linha é descartada e registrada no relatório de importação para revisão humana, evitando escolher silenciosamente uma informação conflitante.

### 5. Pacientes com faltas frequentes

O sistema calcula o histórico de faltas. A funcionalidade de redução de faltas usa um **alerta de confirmação reforçada** para pacientes com pelo menos 2 faltas nos últimos 6 meses ou taxa de falta de pelo menos 50% com 2 ou mais consultas concluídas.

## O que os dados mostraram

Na análise do arquivo fornecido, depois da normalização dos status:

- 4.415 registros foram classificados como `realizada`;
- 2.023 como `falta`;
- 438 como `cancelada_paciente`;
- 115 como `cancelada_clinica`;
- 280 como `agendada`;
- 64 como `confirmada`;
- 24 estavam sem status.

Considerando apenas `realizada` + `falta`, a taxa histórica de falta é aproximadamente **31,4%**.

Alguns recortes chamam atenção:

- segunda-feira: aproximadamente 37,0% de falta;
- demais dias úteis ficaram abaixo desse valor no histórico analisado;
- pacientes identificados como primeira consulta tiveram aproximadamente 33,3% de falta, contra 27,7% nos demais, usando o critério definido;
- convênio e particular ficaram próximos no conjunto analisado, portanto o sistema não assume que convênio seja a principal explicação.

Esses números são descritivos do arquivo recebido, não uma previsão.

## Funcionalidade escolhida

Foi construída uma **confirmação reforçada de consultas de maior risco**.

No dia a dia, a recepção pode abrir uma consulta e gerar uma confirmação simulada. O sistema calcula o perfil de risco usando somente sinais explicáveis:

- histórico recente de faltas;
- primeira consulta na clínica;
- segunda-feira;
- horário da consulta;
- antecedência da marcação.

A API registra a ação como simulação de WhatsApp/SMS/e-mail. Nenhuma mensagem real é enviada.

O objetivo é atacar o problema de forma operacional: em vez de apenas mostrar um gráfico, a recepção recebe uma ação que pode executar.

## Estimativa de impacto

O histórico tem aproximadamente 31,4% de faltas entre realizadas/faltas. Para uma meta inicial conservadora, se a confirmação reforçada evitar 10% das faltas entre os agendamentos elegíveis:

`2.023 faltas históricas × 10% = aproximadamente 202 faltas evitadas`

Como esse histórico cobre aproximadamente 12 meses, a referência inicial seria cerca de **17 faltas evitadas por mês**, caso a mesma proporção de volume e elegibilidade se mantenha.

Esse número é uma meta de medição, não uma garantia de resultado.

## Como avaliar em 3 meses

A clínica deve comparar:

- taxa de falta;
- número absoluto de faltas;
- taxa entre consultas elegíveis para confirmação reforçada;
- taxa entre consultas que receberam confirmação;
- cancelamentos tardios;
- volume de consultas.

A comparação deve usar um período anterior de referência com volume semelhante. O sistema não deve considerar uma redução como efeito da funcionalidade sem observar também possíveis mudanças no volume e no perfil dos pacientes.

## Fora do escopo e riscos

- Não há autenticação.
- Não há integração real com WhatsApp, SMS ou e-mail.
- Não há cobrança de multa.
- Não há overbooking automático.
- Não há cadastro de pacientes ou médicos.
- O cálculo de risco é baseado em regras simples, não em machine learning.
- Dados históricos podem conter erros de preenchimento.
- A confirmação simulada não prova que uma mensagem real teria sido recebida.

## IA

A IA pode ser usada para acelerar a estrutura inicial do projeto, mas o código precisa ser revisado manualmente. Neste projeto, a revisão deve conferir principalmente regras de transição de status, horários, duplicidades, datas, validações e cálculos dos indicadores.
