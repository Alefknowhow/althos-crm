-- Localizador da hospedagem, separado do localizador do pacote e do aéreo —
-- permite exibir o localizador correto em cada bloco do voucher (hospedagem
-- mostra o dela, voos mostram o deles).
ALTER TABLE travel_sales
  ADD COLUMN IF NOT EXISTS hotel_locator TEXT;
