# Fase 7C.5 — Worker → Runtime Adapter Integration

## 1. Objetivo

Integrar o Worker privado existente ao contrato `ExecutionRuntimeAdapter`, mantendo a execução serial, o ACK/retry da fila e a separação do `sourceCode`.

Esta fase estabelece o fluxo integrado:

```text
ExecutionJob
      ↓
Redis Queue
      ↓
Worker
      ↓
ExecutionRuntimeAdapter.execute(request)
      ↓
ExecutionSandbox
      ↓
ExecutionRuntimeResult controlado
```

Nenhuma execução real de Java, Python ou código submetido é implementada.

## 2. Implementação

O Worker recebe uma implementação de `ExecutionRuntimeAdapter` por dependency injection.

O bootstrap do executor compõe:

```text
ConcreteRuntimeAdapter
        ↓
ExecutionSandbox
```

A implementação concreta continua separada do Worker. O Worker não instancia Docker diretamente, não conhece detalhes do `DockerSandbox` e não acessa o `sourceCode`.

## 3. ExecutionRuntimeRequest

O Worker constrói o request somente com dados presentes no `ExecutionJob` e limites controlados:

- `submissionId`;
- `attemptId`;
- `language`;
- `timeoutMs` baseado no limite total do sandbox;
- `memoryMb` baseado no limite do sandbox;
- `pidsLimit` baseado no limite do sandbox;
- `networkDisabled=true`;
- `user=65532:65532`.

O request não contém `sourceCode`, comandos, argumentos, volumes, host paths, secrets ou credenciais.

## 4. Resultado controlado

Como nenhum runtime de linguagem existe nesta fase, o `ConcreteRuntimeAdapter` continua retornando:

```text
status: FAILED
verdict: SYSTEM_ERROR
errorCode: RUNTIME_NOT_IMPLEMENTED
```

Esse resultado é tratado como resultado controlado. O Worker realiza ACK após o adapter retornar o resultado, sem tentar executar código.

Uma exceção lançada pelo adapter continua sendo tratada como falha do processamento e encaminhada para o `retry` existente da fila. A exceção não é escondida.

## 5. Worker

O Worker mantém:

- consumo serial;
- no máximo um job em processamento por vez;
- ACK após retorno bem-sucedido do adapter;
- retry após exceção do adapter;
- shutdown gracioso por `SIGINT` e `SIGTERM`;
- ausência de acesso a Submission e `sourceCode`.

O Worker não executa:

- Java;
- Python;
- shell;
- comandos;
- compilação;
- Docker exec;
- processos filhos.

## 6. Sandbox

O `ExecutionSandbox` permanece lifecycle-only:

```text
create()
   ↓
inspect()
   ↓
destroy()
```

A implementação do sandbox e do `DockerSandbox` não foi alterada nesta fase. O adapter continua sendo o responsável pela orquestração da fronteira, enquanto o sandbox permanece responsável apenas por criar, inspecionar e destruir o ambiente.

## 7. Segurança

As seguintes invariantes permanecem preservadas:

- `sourceCode` não entra no `ExecutionJob`;
- `sourceCode` não entra no Redis;
- `sourceCode` não entra no Worker;
- `sourceCode` não entra no `ExecutionRuntimeRequest`;
- `sourceCode` não entra no `ExecutionRuntimeResult`;
- `sourceCode` não entra no `ExecutionSandbox`;
- Worker não acessa Docker socket;
- Worker não usa shell;
- Worker não usa comandos arbitrários;
- Worker não cria volumes ou host mounts;
- Worker não recebe secrets ou credenciais;
- nenhuma execução privilegiada foi adicionada.

## 8. Testes

Os testes de [apps/executor/src/worker.test.ts](../apps/executor/src/worker.test.ts) cobrem:

- chamada do adapter para um job válido;
- campos permitidos no request;
- ausência de `sourceCode`;
- processamento de resultado controlado;
- chamada única por job;
- processamento serial;
- retry após exceção do adapter;
- ausência de ACK após falha;
- suporte às linguagens já existentes no contrato;
- propagação de falhas Redis.

Os testes utilizam fake queue e fake adapter. Não dependem de Docker real.

## 9. Validações

Validações focadas realizadas:

- teste do Worker → Runtime Adapter;
- typecheck do executor/shared;
- lint do executor/shared;
- testes unitários do executor/shared.

Validações globais devem confirmar:

- typecheck;
- lint;
- testes;
- build.

Falhas preexistentes ou relacionadas ao ambiente de testes da API devem ser diagnosticadas separadamente e não devem ser mascaradas pela integração.

## 10. Fora do escopo

Não faz parte desta fase:

- execução Java;
- execução Python;
- `javac`;
- `java`;
- `python`;
- compilação;
- execução de comandos;
- shell;
- child process;
- Docker exec;
- captura real de stdout;
- captura real de stderr;
- avaliação automática;
- judge;
- persistência de resultado;
- Prisma;
- banco de dados;
- frontend;
- API pública;
- autenticação;
- pagamentos;
- novos endpoints;
- novos serviços Docker;
- alteração do Redis Queue;
- alteração do `ExecutionJob`;
- inclusão de `sourceCode` no fluxo;
- alteração do lifecycle do sandbox.

## 11. Limitações conhecidas

- O adapter ainda produz `RUNTIME_NOT_IMPLEMENTED`.
- O Worker ainda não obtém `sourceCode`; essa decisão permanece para fase futura.
- Não existe runtime Java/Python.
- Não existe avaliação automática.
- Não existe persistência de `ExecutionRuntimeResult`.
- A fila continua usando a semântica existente de `BRPOP`, ACK local e retry explícito.

## 12. Critérios de PASS

A fase pode ser considerada PASS quando:

- Worker recebe `ExecutionRuntimeAdapter` por DI;
- Worker constrói request conforme o contrato;
- adapter é chamado uma vez por job;
- processamento continua serial;
- resultado controlado gera ACK;
- exceção do adapter gera retry;
- `sourceCode` permanece fora de todos os contratos e da fila;
- sandbox não recebe comandos nem source code;
- não há execução de código;
- testes focados passam;
- typecheck passa;
- lint passa;
- testes globais passam;
- build passa;
- nenhuma funcionalidade futura foi antecipada.
