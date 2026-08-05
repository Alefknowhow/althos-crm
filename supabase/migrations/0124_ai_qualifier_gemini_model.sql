-- ai_qualifier_model é lido como modelo Claude compartilhado por várias
-- features (copiloto, chat financeiro, social, funil, suporte — todas
-- presas à API da Anthropic). Guardar o modelo Gemini do qualificador
-- numa coluna separada evita que um valor "gemini-*" vaze pra essas
-- outras chamadas e quebre a API delas.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS ai_qualifier_model_gemini TEXT NOT NULL DEFAULT 'gemini-3.6-flash';
