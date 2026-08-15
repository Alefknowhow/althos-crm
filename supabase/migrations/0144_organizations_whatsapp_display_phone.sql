-- Nome/número legível da conexão WhatsApp (ex.: "+55 47 9737-3758"), pra
-- exibir na tela de Configurações em vez do phone_number_id técnico.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS whatsapp_display_phone TEXT;
