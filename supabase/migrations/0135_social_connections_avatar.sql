-- Foto de perfil da conta Instagram conectada — a tela "Contas conectadas"
-- (Configurações → Social) só mostrava um ícone genérico, sem evidenciar de
-- verdade o uso de instagram_business_basic (nome/username/foto). Guardamos
-- aqui pra exibir a foto real vinda da API.
alter table social_connections add column if not exists avatar_url text;
