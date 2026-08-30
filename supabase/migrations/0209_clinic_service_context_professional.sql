-- Procedimento pode ficar restrito a 1 profissional específico, ou em
-- branco = qualquer profissional pode realizá-lo. Usado pra filtrar o
-- select de profissional no momento de agendar.
ALTER TABLE clinic_service_context
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES clinic_professionals(id) ON DELETE SET NULL;

COMMENT ON COLUMN clinic_service_context.professional_id IS
  'Profissional exclusivo desse procedimento — NULL = qualquer profissional cadastrado pode realizá-lo.';
