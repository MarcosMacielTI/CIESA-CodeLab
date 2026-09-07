# Fase 7C.2 — Docker Sandbox Lifecycle

## Objetivo

Implementar a primeira implementação concreta da abstração `ExecutionSandbox` sem ainda executar qualquer submission.

A implementação deste estágio apenas realiza:

```text
create container
      ↓
inspect container
      ↓
destroy container
```

Nenhuma execução de código, shell, Java, Python ou compilação foi adicionada.

## Biblioteca utilizada

Foi utilizada a biblioteca madura `dockerode` para comunicação com o Docker Engine.

A biblioteca foi escolhida para encapsular a comunicação com o daemon sem provocar uso de `child_process`, `spawn`, `exec`, `execFile` ou `fork` em código do projeto.

## Localização

A implementação concreta do sandbox fica em:

- `packages/shared/src/sandbox.ts`

A abstração segue em:

- `packages/shared/src/index.ts`

## DockerSandbox

`DockerSandbox` implementa `ExecutionSandbox` e encapsula completamente os detalhes do Docker.

Ele realiza:

- criação de container temporário;
- inspeção do container;
- remoção segura do container;
- labels de identificação do projeto;
- configuração de segurança quando suportada pelo daemon e pela API;
- estado de lifecycle explícito.

## Lifecycle

Os estados implementados são:

```text
NEW
  ↓
CREATING
  ↓
CREATED
  ↓
DESTROYING
  ↓
DESTROYED
```

Em falha de criação:

```text
CREATING
  ↓
FAILED
```

`destroy()` é idempotente quando possível, evitando órfãos.

## Configuração de segurança aplicada

A configuração foi enviada ao Docker quando suportada pela API do motor:

- `NetworkDisabled: true`
- `NoNewPrivileges: true`
- `Privileged: false`
- `ReadonlyRootfs: true`
- `CapDrop: ['ALL']`
- `PidsLimit: 32`
- `Memory: 128 * 1024 * 1024`
- `NanoCPUs: 500_000_000`
- `User: '65532:65532'`
- `Binds: []`
- `Mounts: []`
- `Tmpfs: { '/tmp': 'rw,nosuid,nodev,noexec,size=16m' }`
- `Labels` com `project`, `component`, `sandbox`, `managed-by`

## Limitações de segurança

Algumas configurações dependem do daemon, da plataforma e da variante do runtime do container. Quando a API não suporta algum campo, o código não finge que ele foi aplicado.

Em particular:

- `read-only root filesystem` depende do suporte do Docker daemon e da imagem;
- `non-root user` depende da imagem e da presença do usuário 65532:65532;
- `network disabled` e `cap_drop` foram enviados explicitamente e não são meras configurações de documentação.

## Imagem usada

A imagem de referência para o lifecycle é:

```text
busybox:latest
```

Não inclui Java, Python, compilers, JDK, JRE, `pip`, `javac`, `java` ou `python`.

## Não implementado nesta fase

```text
Java
Python
javac
java
python
sourceCode execution
compile
ExecutionResult
worker integration
```

## Containers órfãos

O `destroy()` remove o container com `force: true` e `removeVolumes: false`, evitando vazamento de contêineres no daemon.

## Testes

Os testes cobrem:

- configuração segura;
- `privileged=false`;
- network disabled;
- `cap_drop=ALL`;
- no-new-privileges;
- read-only filesystem;
- PID limit 32;
- memória 128 MB;
- CPU 0.5;
- ausência de host mounts;
- ausência de Docker socket;
- labels;
- usuário não-root;
- lifecycle create/inspect/destroy;
- destroy idempotente;
- ausência de execução de comandos;
- ausência de `sourceCode`.

## Resultado de integração Docker

Se o Docker estiver disponível, esta fase permite a criação, inspeção e destruição do container sem executar qualquer comando interno.

## Segurança de execução

A implementação explícita desta fase garante que:

```text
sourceCode executado: NÃO
Java executado: NÃO
Python executado: NÃO
shell executado: NÃO
child_process: NÃO
spawn: NÃO
exec: NÃO
fork: NÃO
Docker socket: NÃO
host mounts: NÃO
privileged: NÃO
```

## Arquivos envolvidos

- `packages/shared/src/sandbox.ts`
- `packages/shared/src/sandbox.test.ts`
- `docs/PHASE-7C-2.md`
- `packages/shared/package.json`
