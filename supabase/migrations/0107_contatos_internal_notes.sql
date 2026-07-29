-- Campo de observações internas no contato, editável direto no perfil (sem popup).
-- Substitui o mecanismo de "Adicionar Nota" (contato_activities type='note').
alter table contatos add column if not exists internal_notes text;
