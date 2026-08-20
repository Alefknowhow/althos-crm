# Auditoria LGPD — Vertical Clínicas

Snapshot em 2026-08-20, contra o código real do repositório após as
Fases 1–10 da vertical Clínicas. Escopo: dado tratado pelos módulos
Profissionais, Agendamentos (contexto clínico), Atendimentos,
Tratamentos/Pacotes, Lista de Espera, Comissões, Retornos e o dashboard
clínico.

## 1. O que a vertical armazena hoje

Levantamento campo a campo das tabelas `clinic_*`:

| Tabela | Campos com dado pessoal/comercial | Dado clínico sensível? |
|---|---|---|
| `clinic_professionals` | nome, registro profissional, % comissão | Não |
| `clinic_specialties` / `clinic_rooms` | nome | Não |
| `clinic_service_context` | preço, especialidade, sala | Não |
| `clinic_appointment_context` | status operacional (agendado/confirmado/realizado/no_show/...) | Não |
| `clinic_attendances` | `notes` (observações operacionais), `recommendations`, `next_return_date` | **Zona cinzenta — ver §2** |
| `clinic_treatments` | nome do tratamento, `notes` | **Zona cinzenta — ver §2** |
| `clinic_packages` | nome do pacote, valor | Não |
| `clinic_waitlist` | período/horário preferido, `notes` | Não (a menos que a observação livre contenha dado sensível — ver §2) |
| `clinic_commissions` | valores calculados | Não |

**Conclusão do levantamento**: a vertical, como construída até a Fase
10, **não tem nenhum campo estruturado de diagnóstico, CID, prescrição,
exame ou histórico médico**. Isso foi uma decisão de design explícita
em cada fase (documentada nos commits de `clinic_attendances` e
`clinic_treatments`) — não um acidente.

## 2. A zona cinzenta: campos de texto livre

`clinic_attendances.notes`, `clinic_attendances.recommendations` e
`clinic_waitlist.notes` são `TEXT` livre, preenchidos por humanos. Nada
no código impede um profissional de digitar um dado de saúde sensível
ali (ex.: "paciente relatou episódio depressivo", "alérgico a
penicilina"). Isso é uma limitação real, não coberta por RLS nem por
nenhum controle de conteúdo — **é o principal risco LGPD desta
vertical hoje**.

- **RLS**: cobre isolamento entre organizações (nenhuma org vê dado de
  outra) — não distingue "dado comercial" de "dado clínico sensível"
  dentro da mesma org. Qualquer membro com a permissão do módulo
  (`atendimentos_clinica`, etc.) vê o campo de texto livre inteiro.
- **RBAC**: os módulos já são gateados por `checkMemberPermission` +
  granularidade por chave (`atendimentos_clinica`,
  `lista_espera_clinica`, ...) — isso limita QUEM vê a tela, mas não
  limita o QUE pode ser digitado dentro dela.
- **Nenhuma dessas tabelas tem trigger/policy de minimização de dado**
  (ex.: mascarar texto livre, exigir campo estruturado em vez de texto
  aberto).

## 3. Controles já existentes que se aplicam por herança do Core

Estes não foram construídos pela vertical, mas se aplicam a ela porque
ela reutiliza tabelas/infra do Core:

- **RLS por organização** em todas as 12 tabelas `clinic_*` (padrão
  `organization_id IN (SELECT get_user_organizations())` + policy de
  super-admin) — aplicado desde a Fase 1, confirmado presente em todas
  as migrations 0164–0171.
- **Paciente = `contatos`** (nenhuma tabela de paciente duplicada) — a
  exclusão/anonimização de um contato (`/exclusao-de-dados`, já existe
  no Core) se propaga por `ON DELETE CASCADE` em
  `clinic_attendances.patient_contato_id`,
  `clinic_treatments.patient_contato_id`,
  `clinic_packages.patient_contato_id` e `clinic_waitlist.patient_contato_id`
  — ou seja, apagar um contato já remove o rastro clínico associado a
  ele. Verificado nas migrations 0167–0170 (todas usam `ON DELETE
  CASCADE`, não `SET NULL`, no FK de paciente).
- **Backup criptografado** (AES-256, Fase Backup já em produção) cobre
  essas tabelas como qualquer outra — nenhum tratamento especial pra
  dado clínico no backup hoje (ver `docs/backup-disaster-recovery.md`).
- **Nenhum envio a terceiros**: os dados clínicos não são enviados a
  nenhuma API externa (WhatsApp/IA) além do lembrete de agendamento
  (Fase 3), que usa só nome + data/hora — nunca o conteúdo de
  `notes`/`recommendations`.

## 4. O que falta — lacunas reais, não hipotéticas

1. **Log de auditoria de acesso a dado clínico.** O projeto tem
   `super_admin_audit_log` (ações de super-admin) e
   `backup_audit_log` (Fase Backup) — nenhum dos dois cobre "usuário X
   da organização Y abriu o atendimento do paciente Z". Não existe
   hoje um audit trail em nível de aplicação para leitura/edição de
   `clinic_attendances`/`clinic_treatments`. Recomendação: se a clínica
   for tratar dado de saúde de fato (não só operacional), isso precisa
   existir antes — é o item de maior risco de compliance.
2. **Sem controle de conteúdo nos campos de texto livre** (§2) — nem
   validação, nem aviso na UI lembrando o usuário de não digitar dado
   de saúde sensível ali. Recomendação de menor esforço: adicionar um
   aviso inline no formulário (`AtendimentosClient.tsx`) reforçando
   "sem dado clínico sensível" — o placeholder atual já sugere isso,
   mas não é um controle, é só uma dica visual.
3. **Sem retenção/expurgo específico para dado clínico.** O expurgo
   hoje é o mesmo do resto do CRM (exclusão do contato via
   `/exclusao-de-dados` do Core). Não há uma política de retenção
   diferenciada (ex.: "prontuário deve ser mantido por N anos por lei",
   comum em regulamentação de saúde) — porque a vertical não guarda
   prontuário. Se isso mudar no futuro, a política de retenção precisa
   ser desenhada nesse momento, não reaproveitada da política genérica.
4. **Consentimento**: não existe um registro de consentimento
   específico para tratamento de dado de saúde (distinto do
   consentimento genérico de uso da plataforma). Só é obrigatório se a
   vertical passar a armazenar dado de saúde de fato.
5. **Termos de uso/política de privacidade do Althos** não foram
   revisados neste levantamento para confirmar se mencionam
   explicitamente tratamento de dado de saúde pela vertical Clínicas —
   fora do escopo desta auditoria técnica (é revisão jurídica, não de
   código).

## 5. Recomendação prática

A vertical **pode continuar operando como está** (dado comercial/
operacional, sem campo estruturado de saúde) sem risco adicional além
do que já existe no Core. A recomendação concreta, por ordem de
prioridade, **antes de qualquer campo estruturado de diagnóstico/
prescrição/CID ser adicionado**:

1. Implementar audit log de acesso a `clinic_attendances`/
   `clinic_treatments` (item 1 do §4) — pré-requisito real, não
   opcional, se o próximo passo for prontuário de fato.
2. Adicionar aviso inline nos formulários de texto livre reforçando o
   limite atual (item 2) — baixo esforço, mitiga o risco enquanto o
   item 1 não existe.
3. Só então avaliar campos estruturados de dado de saúde — com uma
   auditoria LGPD nova, específica para esse escopo (esta auditoria
   não cobre esse cenário porque ele não existe no código hoje).

Este documento é um snapshot — revalidar contra o código antes de agir
sobre ele, especialmente a lista de campos do §1, que muda a cada nova
fase da vertical.
