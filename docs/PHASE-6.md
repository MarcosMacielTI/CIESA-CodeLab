# Fase 6 — Submissions

As submissions representam somente tentativas de código e seus metadados. Esta fase não executa, compila ou corrige código.

## Linguagens

O projeto ainda não possuía um catálogo de linguagens. A entrada usa o enum simples `JAVA | PYTHON`, alinhado às imagens de infraestrutura existentes. Isso não cria execução nesta fase.

## Rotas

- `POST /exercises/:exerciseId/submissions`
- `GET /exercises/:exerciseId/submissions`
- `GET /submissions/:id`

## Autorização

- Somente `STUDENT` cria submissions.
- O aluno é obtido do token, nunca do body.
- O aluno precisa de matrícula ativa no curso do exercício.
- Aluno vê somente suas próprias submissions.
- Professor vê submissions de cursos onde possui turma.
- Admin vê qualquer submission.

## Limites

`sourceCode` deve ser não vazio e possui limite máximo de 1.000.000 caracteres.

Não existem nesta fase status, score, verdict, stdout, stderr, tempo, memória, SubmissionResult, fila ou executor.
