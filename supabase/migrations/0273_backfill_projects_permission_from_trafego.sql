-- Issue #14 — Agenda → Projetos generalizou o acesso ao módulo de uma
-- permissão de nicho (`trafego`) para uma permissão própria (`projects`).
-- Membros com role 'member' (owner/admin sempre passam por default em
-- canAccess()) que já tinham `trafego: true` explícito no JSON de
-- permissions perderiam o acesso a Projetos sem este backfill, porque
-- `projects` nunca existiu na coluna antes de hoje (achado da revisão
-- automática do PR #53). Não mexe em quem não tinha `trafego` concedido.

UPDATE memberships
SET permissions = permissions || '{"projects": true}'::jsonb
WHERE role = 'member'
  AND (permissions ->> 'trafego') = 'true'
  AND (permissions ->> 'projects') IS NULL;
