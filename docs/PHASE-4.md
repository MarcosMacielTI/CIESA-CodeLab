# Fase 4 — Cursos, Turmas e Matrículas

## Estrutura adicionada

- `Course`: curso acadêmico com `code` único e `status` ativo/inativo.
- `Class`: turma vinculada a um curso e um professor responsável.
- `Enrollment`: matrícula de um aluno em uma turma.

## Relacionamentos

- `Course` tem muitas `Class`.
- `Class` pertence a um `Course` e um `User` professor.
- `Class` tem muitas `Enrollment`.
- `User` pode possuir muitas turmas como professor e muitas matrículas.
- `Enrollment` pertence a um `Class` e a um `User` aluno.

## Autorização

- `ADMIN`: acesso global a cursos, turmas e matrículas.
- `TEACHER`: acesso somente às turmas e matrículas das turmas próprias.
- `STUDENT`: acesso somente às matrículas e turmas próprias.

## Decisão de remoção de matrícula

As matrículas não são apagadas fisicamente. Em vez disso, o campo `status` é atualizado para `INACTIVE`, preservando o histórico acadêmico e evitando perda de integridade dos dados.

## Migration

Comando usado para criar o schema da fase:

```bash
pnpm --dir apps/api exec prisma migrate dev --name add_academic_structure
```

## Testes

```bash
pnpm --dir apps/api exec vitest run
```

## Endpoints

- `POST /courses`
- `GET /courses`
- `GET /courses/:id`
- `PATCH /courses/:id`
- `POST /classes`
- `GET /classes`
- `GET /classes/:id`
- `PATCH /classes/:id`
- `POST /enrollments`
- `GET /enrollments`
- `GET /enrollments/:id`
- `DELETE /enrollments/:id`
