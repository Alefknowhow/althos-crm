-- Althos Voice: adiciona a feature 'voice' ao catálogo de planos.
-- Disponível somente em Pro e Business (mirror de lib/plans/config.ts).
UPDATE plans SET features = features || '{"voice": false}'::jsonb WHERE id IN ('free', 'starter');
UPDATE plans SET features = features || '{"voice": true}'::jsonb WHERE id IN ('pro', 'business');
