-- Funis disparados por comentário só respondiam em privado (DM), pra iniciar
-- a conversa — nunca publicavam nada no post. Esse flag deixa o dono do
-- negócio optar por também responder publicamente no comentário.
alter table social_funnels add column if not exists reply_publicly boolean not null default false;
