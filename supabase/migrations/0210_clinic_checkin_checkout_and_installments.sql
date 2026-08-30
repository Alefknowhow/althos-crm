-- Chegada/finalização do atendimento — carimbadas automaticamente quando o
-- status clínico avança pra 'em_atendimento' (chegou) e 'realizado'
-- (finalizou), dentro de setClinicAppointmentStatus.
ALTER TABLE clinic_appointment_context
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

COMMENT ON COLUMN clinic_appointment_context.checked_in_at IS
  'Horário em que o paciente chegou — carimbado ao avançar o status pra em_atendimento.';
COMMENT ON COLUMN clinic_appointment_context.finished_at IS
  'Horário em que o atendimento foi finalizado — carimbado ao avançar o status pra realizado.';

-- Parcelamento no cartão de crédito — só metadado informativo (quem
-- fatura/parcela é a operadora do cartão, não a clínica); não precisa virar
-- múltiplas linhas em financial_entries.
ALTER TABLE clinic_attendances
  ADD COLUMN IF NOT EXISTS installments SMALLINT;

COMMENT ON COLUMN clinic_attendances.installments IS
  'Número de parcelas no cartão de crédito, quando payment_method = credito. NULL pros demais métodos.';
