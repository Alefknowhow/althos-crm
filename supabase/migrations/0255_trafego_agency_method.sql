-- Módulo Clientes (Tráfego) — Fase 3.2: Marketing Strategist (IA).
-- "Método da Agência" (spec § 10) é reutilizável entre TODOS os clientes de
-- tráfego da organização — não pertence a um cliente específico, por isso
-- vive em organizations, não em contatos.traffic_client_profile.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trafego_agency_method JSONB;
COMMENT ON COLUMN organizations.trafego_agency_method IS
  'Módulo Clientes (Tráfego) — método/protocolo da agência (regras de estrutura de campanha, critérios de teste, formatos mínimos de criativo, critérios de otimização/pausa) usado como contexto pelo Marketing Strategist (IA) junto com o perfil de cada cliente.';
