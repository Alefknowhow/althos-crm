-- Althos Voice — Fase 4: suporte a retry de chamadas não atendidas
-- (disparadas por automação) com teto global de tentativas.
ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS attempt_number integer NOT NULL DEFAULT 1;
ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 1;
ALTER TABLE voice_calls ADD COLUMN IF NOT EXISTS automation_context text;

COMMENT ON COLUMN voice_calls.max_attempts IS 'Teto de tentativas configurado no step "Iniciar Voice AI" da automação (padrão 1 = sem retry). Nunca permitir retry ilimitado.';
