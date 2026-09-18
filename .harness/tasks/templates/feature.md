# <título da tarefa>

- **Status**: backlog | active | blocked | completed
- **Criado em**: <data>
- **Responsável**: <humano/agente>
- **Issue**: #<numero> (<url> quando disponível) — obrigatório para trabalho não-trivial, ver `.harness/workflow.md` § 2
- **Tipo**: feature | fix | refactor | perf | chore | hotfix | docs
- **Branch**: <feat/fix/refactor/perf/chore/hotfix>/<issue>-<descricao> — nunca `master`, ver `.harness/workflow.md` § 3
- **PR**: not_created até existir; depois #<numero> (<url>)

## Workflow Status
> Preencher/atualizar conforme a tarefa avança pelo pipeline de
> `.harness/workflow.md` § 0. Estados: `not_started | pending |
> in_progress | passed | failed | blocked | completed | not_applicable`.
> `Vercel Preview`/`Human QA` só viram `not_applicable` quando a mudança é
> comprovadamente sem impacto executável (só doc/processo) — ver
> `.harness/workflow.md` § 8. `Merge` nunca vira `approved`/`completed`
> sem autorização humana explícita registrada.

```
Issue:          not_started
Implementation: not_started
Validation:     pending
Push:           pending
PR:             not_created
Codex Review:   pending
Vercel Preview: pending
Human QA:       pending
Merge:          blocked
Production:     not_deployed
```

## Objective
<o que essa tarefa entrega, em 1-2 frases — o resultado, não a implementação>

## Context
<por que isso está sendo feito agora; o que motivou; link pra conversa/issue se houver>

## Scope
**Dentro do escopo:**
- <item>

**Fora do escopo (deliberadamente):**
- <item>

## Requirements
- <requisito funcional 1>
- <requisito funcional 2>

## Acceptance Criteria
- [ ] <critério verificável 1>
- [ ] <critério verificável 2>

## Affected Modules
<arquivos/pastas/tabelas que serão tocados>

## Database Impact
<nenhum | descrição da migration + RLS/policy/índice necessários>

## Security Impact
<nenhum | descrição — nova permissão? nova superfície pública? novo secret?>

## UX Impact
<nenhum | telas afetadas, mobile/desktop, novo estado de loading/empty/error>

## AI Impact
<nenhum | novo consumo de crédito, novo prompt, nova tool, novo modelo>

## Testing
<o que será testado e como — unit test novo? verificação manual? preview?>

## Risks
<o que pode dar errado; dependência de aprovação humana (migration destrutiva, RLS, auth)>

## Verification
<preencher ao concluir — resultado real de cada comando rodado>

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS / FAIL / NOT CONFIGURED |
| `npm run lint` | PASS / FAIL / NOT CONFIGURED |
| `npm test` | PASS / FAIL / NOT CONFIGURED |
| `npm run build` | PASS / FAIL / NOT CONFIGURED |

## Codex Review
<preencher quando o PR existir — não copiar o review inteiro, o PR é a fonte de verdade>

```
Status: pending | in_progress | passed | findings | blocked | not_applicable
PR: #<numero>
Blocker: <n>
High: <n>
Medium: <n>
Low: <n>
Findings resolved: <x>/<y>
```

## Vercel Preview
<not_applicable só quando comprovadamente sem impacto executável — ver .harness/workflow.md § 8>

```
Status: pending | available | failed | validated | not_applicable
URL: <preview-url quando disponível>
Human QA: pending | approved | changes_requested | not_applicable
```

## Blockers
<none, ou lista objetiva — ex.: "Codex reportou 1 HIGH de autorização", "SUPABASE_URL ausente no Preview">

## Next Action
<resposta direta a "qual é exatamente o próximo passo?" — ex.: "Resolver 2 findings HIGH do Codex no PR #328", "Aguardando validação humana do Preview", "Aguardando autorização explícita para merge do PR #328">

## Notes
<qualquer coisa relevante que não coube nas seções acima>
