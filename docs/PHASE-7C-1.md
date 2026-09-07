# Fase 7C.1 — Infraestrutura base do Sandbox

## Objetivo

Esta fase define a fronteira tipada para um sandbox descartável futuro. A implementação atual é somente uma abstração e uma fake in-memory para testes.

```text
Worker confiável
      |
      v
ExecutionSandbox
      |
      v
Futura implementação Docker/container
```

## Localização

A abstração está em `packages/shared/src/sandbox.ts`, junto das abstrações de infraestrutura compartilhadas pela fila. O executor pode futuramente fornecer uma implementação concreta sem expor detalhes de Docker ao worker.

## Interface

`ExecutionSandbox` possui somente:

- `state`;
- `create()`;
- `destroy()`.

A interface não recebe source code, comandos, executáveis, argumentos, volumes ou secrets.

## Fake

`FakeSandbox` mantém apenas estado em memória:

- `NEW`;
- `CREATED`;
- `DESTROYED`.

Ela não abre processos, não executa shell, não usa Docker, não acessa rede ou filesystem do host e não recebe código submetido.

## Configuração contratual

Os limites iniciais representados são:

- memória: 128 MB;
- CPU: 0.5 vCPU;
- PIDs: 32;
- armazenamento temporário: 16 MB;
- stdout: 64 KB;
- stderr: 64 KB;
- compilação Java: 5 s;
- execução Java: 2 s;
- execução Python: 2 s;
- timeout total: 10 s.

A configuração de segurança desta fase é apenas contratual. Enforcement real dos limites será responsabilidade da futura implementação do sandbox/container.

## Requisitos de segurança futuros

A futura implementação deverá garantir:

- usuário não-root;
- filesystem raiz read-only;
- rede desabilitada;
- no-new-privileges;
- capabilities removidas;
- limite de PIDs, memória e CPU;
- filesystem temporário limitado;
- nenhum mount do host;
- nenhum Docker socket;
- nenhum modo privileged;
- nenhum secret ou credencial de API, banco ou Redis.

## Limites desta fase

Não foi implementado:

- Docker;
- Dockerfile de runtime;
- container;
- sandbox real;
- execução Java ou Python;
- compilação;
- worker integration;
- child_process, spawn, exec ou fork;
- acesso a submissions;
- migration ou alteração de Prisma;
- alterações no worker 7B.3.
