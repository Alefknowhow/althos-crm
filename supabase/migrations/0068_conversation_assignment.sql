-- Conversation-level "responsável pelo atendimento".
--
-- Until now the only owner concept was leads.assigned_to (the salesperson on
-- the funnel). Atendimento (WhatsApp) is a different hat: the person CURRENTLY
-- handling the conversation. We model it on the conversation itself, and the
-- UI falls back to the lead owner when this is null (hybrid model).
--
-- No FK to auth.users (Supabase managed schema); we store the user id and
-- resolve names via the admin API, same pattern as leads.assigned_to.

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS assigned_to UUID;

-- Fast inbox filtering by atendente.
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_assigned_to
  ON whatsapp_conversations (organization_id, assigned_to);
