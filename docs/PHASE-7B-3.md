# Fase 7B.3 — Worker privado

Esta fase adiciona um consumidor serial da fila de jobs em `apps/executor/src/worker.ts`.

## Funcionamento

- `ExecutionWorker` consome `ExecutionQueue` com polling bloqueante de 1 segundo.
- O job já chega validado pela fila compartilhada.
- O handler padrão registra somente `submissionId`, `attemptId` e `language`.
- Nenhum `sourceCode` é acessado.
- ACK ocorre somente após o handler concluir com sucesso.
- Falhas do handler são encaminhadas para `retry` da fila.
- Concorrência inicial: um job por worker.
- `SIGINT` e `SIGTERM` solicitam shutdown gracioso; o loop encerra após o polling atual e a conexão é fechada.

## Entrypoint

```bash
pnpm --filter @ciesa/executor worker
```

O placeholder `src/index.ts` continua separado e não foi transformado em executor.

## Limitação conhecida

A fila atual usa `BRPOP`, que remove a mensagem durante o consumo. Se o processo morrer depois do `BRPOP` e antes do ACK, a mensagem não pode ser recuperada pela implementação atual. Lease, visibility timeout, pending list ou stream com consumer group ficam para o hardening futuro.

## Segurança

O worker desta fase não executa código, não cria containers, não usa Docker socket, não acessa submissions, não compila Java/Python e não inicia worker paralelo.
