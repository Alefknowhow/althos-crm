-- Validação interna de conversões reportadas pelo cliente no Portal
-- (issue #27/#61, passo 2.5) — "o portal é complemento, não segunda fonte
-- conflitante": a agência confirma antes de entrar em relatórios/CAPI.
alter table portal_conversions
    add column if not exists validated_at timestamptz,
    add column if not exists validated_by uuid;
