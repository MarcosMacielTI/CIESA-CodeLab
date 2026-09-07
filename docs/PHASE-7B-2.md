# Fase 7B.2 — Redis Queue

Esta fase adiciona somente a abstração `ExecutionQueue` em `packages/shared`.

## Implementação

- Cliente Redis de produção: `ioredis`, já utilizado pelo workspace.
- Estrutura: Redis List com `RPUSH` para publicar e `BRPOP` para consumir.
- Payload: `ExecutionJob` validado por Zod antes da publicação e após o consumo.
- Identidade: `submissionId:attemptId` identifica a mensagem para processamento futuro.
- ACK: `BRPOP` remove a mensagem da lista; `acknowledge` encerra o controle local da mensagem consumida.
- Retry: reencaminhamento explícito com contador e limite padrão de uma tentativa.
- Falha Redis: propagada como erro de infraestrutura; não altera nem remove submissions.

## Limites desta fase

Não existe worker, consumo contínuo, integração com submissions, sandbox, execução, compilação, container ou fila de negócio.
O contrato não contém `sourceCode`, secrets, credenciais ou parâmetros de Docker.
