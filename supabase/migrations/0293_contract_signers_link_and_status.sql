-- Issue #60, B.5 — link de assinatura POR signatário (hoje só o primeiro
-- signatário tem link salvo, em contracts.signature_link) + status mais
-- granular (rejected/viewed) vindo dos eventos do webhook da Autentique.
alter table contract_signers
    add column if not exists signature_link text,
    add column if not exists viewed_at timestamptz,
    add column if not exists rejected_at timestamptz;

alter table contract_signers drop constraint if exists contract_signers_status_check;
alter table contract_signers add constraint contract_signers_status_check
    check (status in ('pending', 'sent', 'viewed', 'signed', 'rejected'));
