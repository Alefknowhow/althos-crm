-- Sistema de tracking próprio — fase 2: reenvio de clique pro CAPI da Meta.
-- Quando um clique chega com fbclid (anúncio do Facebook/Instagram), o
-- redirect (app/r/[code]/route.ts) sintetiza o valor de _fbc no formato
-- documentado pela Meta (fb.1.<timestamp>.<fbclid>) e guarda aqui — serve de
-- fallback pro evento CAPI Lead quando o cookie _fbc do pixel não chegou até
-- o formulário (comum: bloqueio de 3rd-party cookie, pixel não carregou a
-- tempo, etc.). Ver actions/public_forms.ts::submitPublicForm.
ALTER TABLE tracking_clicks ADD COLUMN IF NOT EXISTS fbc TEXT;
