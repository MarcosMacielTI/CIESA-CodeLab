# Fase 7C.3 — Contrato de Execução e Adaptador do Sandbox

## 1. Objetivo

Definir formalmente a camada arquitetural entre a intenção de execução transportada pelo `ExecutionJob`, o worker privado, um futuro `ExecutionRuntimeAdapter` e o `ExecutionSandbox`.

Esta fase prepara a arquitetura para uma futura execução real de Java e Python, sem executar código do aluno. O objetivo é estabelecer contratos, boundaries, estados, responsabilidades e critérios de validação para que a implementação futura seja isolada, testável e segura.

Nenhum contrato de runtime ou adapter descrito neste documento está implementado nesta fase. Eles são especificações para implementação posterior.

## 2. Contexto

As fases seguintes já foram concluídas e validadas:

- Fase 7B.2 — Redis Queue;
- Fase 7B.3 — Worker privado;
- Fase 7C.1 — Infraestrutura base do Sandbox;
- Fase 7C.2 — Docker Sandbox Lifecycle.

A Fase 7C.2 validou contra Docker real o lifecycle:

```text
CREATE → INSPECT → DESTROY
```

Também foram validados os requisitos de isolamento representados pelo sandbox atual:

- `NetworkDisabled=true`;
- `NetworkMode=none`;
- `ReadonlyRootfs=true`;
- `NoNewPrivileges=true`;
- `Privileged=false`;
- `CapDrop=ALL`;
- `PidsLimit=32`;
- `Memory=128 MB`;
- `NanoCPUs=500000000`;
- `User=65532:65532`;
- `Binds=[]`;
- `Mounts=[]`;
- ausência de container órfão após `destroy()`.

O sandbox atual deve continuar responsável somente pelo lifecycle do ambiente isolado. A fila atual continua transportando um `ExecutionJob` mínimo, sem `sourceCode`.

## 3. Estado inicial

O estado existente no início desta fase é:

- `ExecutionJob` existe em `packages/contracts/src/index.ts`;
- `ExecutionResult` existe em `packages/contracts/src/index.ts`, mas ainda é apenas um tipo de contrato e não é produzido por um runtime implementado;
- `ExecutionSandbox` existe em `packages/shared/src/sandbox.ts`;
- `FakeSandbox` existe para testes;
- `DockerSandbox` existe para o lifecycle de criação, inspeção e destruição;
- `RedisExecutionQueue` transporta e valida `ExecutionJob`;
- o worker privado consome jobs, controla ACK/retry e permanece sem lógica de execução;
- não existe `ExecutionRuntimeRequest` implementado;
- não existe `ExecutionRuntimeAdapter` implementado;
- não existe execução real de Java, Python, compilação ou avaliação automática.

O `ExecutionJob` atual contém somente:

- `contractVersion`;
- `submissionId`;
- `attemptId`;
- `language`.

O `ExecutionJob` não contém `sourceCode`, comandos, credenciais ou detalhes de Docker. Essa característica deve ser preservada.

## 4. Escopo

Faz parte desta fase somente a especificação conceitual de:

- um contrato futuro `ExecutionRuntimeRequest`;
- um contrato futuro `ExecutionRuntimeResult`;
- uma interface conceitual futura `ExecutionRuntimeAdapter`;
- os estados do job, do sandbox e do resultado;
- as responsabilidades de cada camada;
- os requisitos de segurança que as fases futuras deverão preservar;
- os testes que deverão ser implementados posteriormente;
- os critérios objetivos de PASS/FAIL.

O `ExecutionJob` continua mínimo e representa apenas a intenção de execução. O `sourceCode` continua fora da fila. O `ExecutionSandbox` continua sendo lifecycle-only.

A forma exata de obter o código submetido para uma execução futura não é definida nesta fase.

## 5. Arquitetura

O fluxo arquitetural previsto é:

```text
ExecutionJob
      ↓
Redis Queue
      ↓
Worker
      ↓
ExecutionRuntimeAdapter
      ↓
ExecutionSandbox
```

A separação de responsabilidades é obrigatória:

- `ExecutionJob` representa a intenção de executar uma tentativa;
- Redis transporta o job;
- o worker consome o job e delega o processamento;
- o `ExecutionRuntimeAdapter` coordena futuramente a execução de um runtime;
- o `ExecutionSandbox` cria, inspeciona e destrói o ambiente isolado.

O código submetido permanece conceitualmente separado:

```text
Submission
   ├── sourceCode → persistência
   │
   └── referência da tentativa
             ↓
       ExecutionJob
             ↓
          Redis Queue
```

O `sourceCode` não deve ser incorporado ao `ExecutionJob`, serializado na fila ou incluído nos contratos definidos nesta fase.

## 6. ExecutionRuntimeRequest

`ExecutionRuntimeRequest` é um contrato futuro para representar os dados necessários ao adapter para preparar uma execução. Ele não está implementado nesta fase.

A proposta mínima é:

```text
ExecutionRuntimeRequest
├── submissionId: string
├── attemptId: string
├── language: ExecutionLanguage
└── limits: ExecutionRuntimeLimits
```

`ExecutionRuntimeLimits` deve representar limites aprovados para a execução, sem transportar comandos ou recursos secretos. Conceitualmente, pode conter:

- `timeoutMs` — orçamento de tempo aplicável à execução;
- `memoryMb` — limite de memória;
- `pidsLimit` — limite de processos;
- `networkDisabled` — requisito de rede desabilitada;
- `user` — identidade não-root exigida para o ambiente.

### Avaliação dos campos candidatos

- `submissionId`: necessário para correlacionar a execução com a submission persistida;
- `attemptId`: necessário para distinguir tentativas e correlacionar request e result;
- `language`: necessário para selecionar futuramente o runtime apropriado, sem transformar o sandbox em executor de linguagem;
- `timeoutMs`: necessário para aplicar o orçamento temporal da execução;
- `memoryMb`: necessário para expressar o limite de memória esperado;
- `pidsLimit`: necessário para expressar o limite de processos;
- `networkDisabled`: necessário como requisito de segurança do ambiente;
- `user`: necessário para preservar a exigência de execução como usuário não-root.

O request não deve conter:

- `sourceCode`;
- senha;
- token;
- secret;
- credencial de banco, Redis, API ou Docker;
- host path;
- Docker socket;
- comando arbitrário;
- argumentos arbitrários;
- volume arbitrário;
- instrução de shell.

Os limites devem ser validados contra uma política aprovada. Este documento não define ainda a implementação dessa validação nem altera `defaultSandboxLimits` ou `defaultSandboxSecurityRequirements` existentes.

## 7. ExecutionRuntimeResult

`ExecutionRuntimeResult` é um contrato futuro para representar o resultado produzido pelo runtime adapter. Ele não está implementado nesta fase.

A proposta conceitual mínima é:

```text
ExecutionRuntimeResult
├── contractVersion
├── submissionId
├── attemptId
├── status
├── verdict
├── stdout
├── stderr
├── exitCode
├── executionTimeMs
├── memoryUsedMb
└── errorCode
```

Finalidade dos campos:

- `contractVersion`: identifica a versão do contrato do resultado;
- `submissionId`: correlaciona o resultado com a submission;
- `attemptId`: correlaciona o resultado com a tentativa;
- `status`: representa o estado operacional da execução;
- `verdict`: representa a interpretação da execução, quando houver uma;
- `stdout`: representa a saída padrão limitada coletada pelo runtime;
- `stderr`: representa a saída de erro limitada coletada pelo runtime;
- `exitCode`: representa o código de saída quando o processo produzir um;
- `executionTimeMs`: representa o tempo medido da execução;
- `memoryUsedMb`: representa o uso de memória quando essa medição estiver disponível;
- `errorCode`: representa um código estável para falhas de runtime ou infraestrutura.

O resultado deve ser capaz de representar conceitualmente:

- execução concluída;
- falha de compilação;
- erro de runtime;
- timeout;
- cancelamento;
- erro de infraestrutura.

A ausência de um verdict deve ser permitida quando a execução não chegar à etapa de avaliação ou quando ocorrer uma falha de infraestrutura. A semântica final de `status`, `verdict` e `errorCode` deverá ser formalizada antes da implementação do runtime.

O resultado não deve conter secrets, tokens, credenciais, host paths ou detalhes que exponham o ambiente do host.

## 8. ExecutionRuntimeAdapter

`ExecutionRuntimeAdapter` é uma interface conceitual futura. Ela será a fronteira entre o worker e um runtime de execução, sem expor detalhes de runtime ao worker e sem transferir responsabilidade de execução ao `ExecutionSandbox`.

A interface deve ser pequena e orientada ao lifecycle da execução. A forma inicial recomendada é uma operação de alto nível que receba um request e produza um result:

```text
ExecutionRuntimeAdapter
└── execute(request): Promise<ExecutionRuntimeResult>
```

Essa operação deve futuramente coordenar, internamente, a criação do sandbox, a preparação do ambiente, a execução controlada, a coleta do resultado e a destruição do sandbox.

Operações como `prepare()`, `start()`, `inspect()`, `stop()`, `collectResult()` e `cleanup()` não devem ser adicionadas automaticamente à interface pública. Elas somente serão separadas se uma fase posterior demonstrar necessidade de controle, observabilidade, cancelamento ou testes de cada etapa individual.

Quando uma decomposição explícita for necessária, as responsabilidades conceituais serão:

- `prepare()`: preparar os recursos necessários sem executar o código do aluno;
- `start()`: iniciar a execução controlada;
- `inspect()`: observar o estado da execução ou do sandbox;
- `stop()`: interromper uma execução em andamento por timeout ou cancelamento;
- `collectResult()`: coletar e normalizar o resultado limitado;
- `cleanup()`: garantir destruição e liberação dos recursos.

Nesta fase, esses métodos são somente conceitos avaliados, não contratos implementados.

O adapter não deve:

- ser usado para transportar `ExecutionJob` diretamente pela fila;
- expor comandos arbitrários ao worker;
- permitir acesso direto do worker ao Docker;
- transformar `ExecutionSandbox` em executor de linguagem;
- buscar ou persistir `sourceCode` sem um contrato futuro explícito de acesso controlado.

## 9. Estados

Os estados devem ser separados em três categorias distintas.

### Estado do job

Representa o estado operacional do trabalho na plataforma:

- `QUEUED` — job aguardando consumo;
- `INITIALIZING` — job recebido e em preparação;
- `RUNNING` — execução em andamento;
- `SUCCEEDED` — processamento concluído com resultado produzido;
- `FAILED` — processamento encerrado por falha;
- `TIMEOUT` — processamento encerrado por exceder o tempo permitido;
- `CANCELLED` — processamento encerrado por cancelamento.

Esses estados não descrevem diretamente o estado físico do container.

### Estado do sandbox

Continua sendo responsabilidade do `ExecutionSandbox`. Os estados existentes são:

- `NEW`;
- `CREATING`;
- `CREATED`;
- `DESTROYING`;
- `DESTROYED`;
- `FAILED`.

O estado do sandbox descreve somente o lifecycle do ambiente isolado. Ele não representa compilação, execução, verdict ou aceitação da submission.

### Resultado ou verdict

O resultado representa a saída normalizada do runtime. O verdict representa a interpretação da execução, quando aplicável, por exemplo:

- aceito;
- resposta incorreta;
- erro de compilação;
- erro de runtime;
- limite de tempo;
- limite de memória;
- limite de saída;
- erro de sistema.

Um job pode terminar sem verdict quando ocorrer uma falha de infraestrutura antes de existir uma avaliação válida. Estado, resultado e verdict não devem ser tratados como sinônimos.

## 10. Responsabilidades por camada

### Submission

Responsável por:

- receber a submission;
- validar os dados de entrada da submission;
- persistir `sourceCode`;
- manter os dados da tentativa.

Não executa código.

### ExecutionJob

Responsável por:

- representar a intenção de execução;
- identificar a submission e a tentativa;
- informar a linguagem declarada.

Não contém `sourceCode`, secrets, credenciais, comandos ou detalhes de infraestrutura.

### Redis Queue

Responsável por:

- transportar `ExecutionJob`;
- validar o formato do job;
- controlar consumo, ACK e retry conforme o contrato existente.

Não executa código e não transporta `sourceCode`.

### Worker

Responsável por:

- consumir o job;
- delegar o processamento ao adapter quando essa integração existir;
- controlar ACK e retry;
- realizar shutdown gracioso.

Não deve:

- executar shell;
- executar Java;
- executar Python;
- acessar `sourceCode` diretamente;
- executar Docker diretamente;
- compilar código;
- decidir regras específicas de runtime.

### ExecutionRuntimeAdapter

Responsável futuramente por:

- adaptar a solicitação ao runtime escolhido;
- coordenar a execução controlada;
- utilizar o sandbox conforme o seu contrato de lifecycle;
- obter e normalizar o resultado;
- controlar o lifecycle necessário para a execução futura.

Nesta fase, somente o boundary e o contrato conceitual são definidos.

### ExecutionSandbox

Responsável por:

- criar o ambiente isolado;
- inspecionar o ambiente;
- destruir o ambiente;
- preservar as configurações de segurança já validadas.

Não conhece:

- Java;
- Python;
- `javac`;
- `python`;
- comandos de compilação;
- comandos de execução;
- `sourceCode`;
- avaliação;
- verdict.

## 11. Requisitos de segurança

As fases futuras devem preservar os requisitos já estabelecidos e validados nas fases 7C.1 e 7C.2:

- container não privilegiado;
- usuário não-root;
- filesystem root somente leitura;
- rede desabilitada;
- `no-new-privileges`;
- capabilities removidas;
- limite de memória;
- limite de CPU;
- limite de PIDs;
- `/tmp` limitado;
- nenhum host mount;
- nenhum Docker socket;
- nenhum secret;
- nenhum acesso arbitrário ao host.

A Fase 7C.3 não implementa novamente essas proteções. Ela somente documenta que o futuro adapter e os futuros runtimes devem utilizá-las e não podem contorná-las.

A configuração concreta atualmente documentada pela Fase 7C.2 permanece a referência de segurança do sandbox, incluindo `Memory=128 MB`, `NanoCPUs=500000000`, `PidsLimit=32`, `User=65532:65532`, `NetworkMode=none`, `ReadonlyRootfs=true`, `CapDrop=ALL`, ausência de mounts do host e ausência de Docker socket.

## 12. Testes previstos

Os testes abaixo serão implementados em fases posteriores, quando os contratos e o adapter forem codificados.

### Contratos

- request válido;
- request inválido;
- ausência de `sourceCode`;
- ausência de secrets;
- validação dos campos obrigatórios;
- limites válidos e inválidos;
- result válido;
- result inválido;
- correlação consistente entre `submissionId` e `attemptId`.

### Adapter

Se essas etapas forem expostas no contrato futuro, testar:

- `prepare`;
- `start`;
- `inspect`;
- `stop`;
- `collectResult`;
- `cleanup`.

Caso permaneça uma operação de alto nível `execute`, testar o fluxo equivalente como uma unidade contratual, sem exigir que cada etapa seja uma operação pública.

### Worker

Validar futuramente:

- job recebido;
- delegação para o adapter;
- ACK após sucesso;
- retry após falha;
- shutdown gracioso;
- ausência de execução direta.

### Segurança

Validar futuramente:

- ausência de `privileged`;
- ausência de host mounts;
- ausência de Docker socket;
- network disabled;
- usuário não-root;
- limites preservados;
- ausência de secrets e credenciais no request/result;
- ausência de `sourceCode` no `ExecutionJob` e na mensagem da fila.

## 13. Fora do escopo

Não faz parte da Fase 7C.3:

- execução Java;
- execução Python;
- `javac`;
- `java`;
- `python`;
- shell;
- `child_process`;
- `spawn`;
- `exec`;
- `execFile`;
- `fork`;
- execução de `sourceCode`;
- compilação;
- avaliação automática;
- captura real de stdout do aluno;
- imagens Java/Python;
- Docker exec para código do aluno;
- alteração do lifecycle do `DockerSandbox`;
- alteração do Redis Queue;
- alteração do `ExecutionJob` para adicionar `sourceCode`;
- alteração do Prisma;
- migrations;
- alteração do frontend;
- implementação completa do worker/runtime;
- instalação de dependências;
- alterações no Docker Compose;
- commit ou push.

## 14. Critérios PASS/FAIL

A Fase 7C.3 será considerada **PASS** somente quando a especificação e a futura implementação correspondente atenderem a todos os itens abaixo:

- contrato de runtime definido;
- contrato de resultado definido;
- adapter definido;
- `ExecutionJob` permanece sem `sourceCode`;
- queue permanece sem `sourceCode`;
- worker permanece sem execução de código;
- `ExecutionSandbox` continua lifecycle-only;
- responsabilidades separadas;
- estados definidos e não misturados;
- requisitos de segurança documentados;
- testes futuros definidos;
- nenhuma execução real implementada nesta fase;
- nenhuma alteração de Prisma necessária;
- nenhuma alteração de frontend necessária;
- nenhuma alteração do lifecycle do `DockerSandbox` necessária;
- nenhuma dependência nova instalada.

A fase será considerada **FAIL** se a implementação correspondente fizer qualquer uma das seguintes ações:

- adicionar `sourceCode` ao `ExecutionJob` ou à mensagem Redis;
- colocar execução de linguagem no sandbox;
- colocar execução direta no worker;
- expor Docker socket, host mount ou credenciais;
- adicionar execução real de Java, Python ou shell;
- alterar Prisma, migrations, frontend, fila ou DockerSandbox lifecycle sem escopo posterior aprovado.

## 15. Próxima etapa

A execução real de runtime será tratada em uma fase posterior e separada.

Essa fase futura poderá tratar progressivamente de:

- runtime Java;
- runtime Python;
- compilação;
- execução;
- captura de stdout/stderr;
- timeout;
- resultado real;
- integração progressiva com o worker.

Os detalhes de implementação dessa próxima fase não são definidos por este documento.

## 16. Limitações conhecidas

- `ExecutionRuntimeRequest` não existe atualmente no código e é apenas uma proposta contratual desta especificação;
- `ExecutionRuntimeAdapter` não existe atualmente no código e não deve ser considerado implementado;
- `ExecutionResult` já existe como tipo em `packages/contracts/src/index.ts`, mas ainda não há runtime que o produza;
- o `ExecutionJob` atual contém apenas `contractVersion`, `submissionId`, `attemptId` e `language`;
- a forma futura de obter `sourceCode` a partir da referência da tentativa ainda não foi definida;
- a persistência de resultados de execução ainda não foi definida;
- a semântica final dos estados, verdicts e códigos de erro deverá ser refinada antes da implementação do runtime;
- a separação entre uma operação única `execute` e operações públicas de lifecycle do adapter ainda depende dos requisitos de cancelamento, observabilidade e testes da fase de implementação;
- os limites descritos neste documento são requisitos contratuais e referências de segurança, não uma implementação de execução;
- nenhuma execução real, integração do worker com runtime ou alteração de infraestrutura é criada por esta fase.
