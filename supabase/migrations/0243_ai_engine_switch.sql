insert into system_config (key, value, description)
values (
  'ai_engine',
  '{"provider": "anthropic"}'::jsonb,
  'Motor de IA usado por TODAS as chamadas de texto (Anthropic SDK) da plataforma. value.provider: "anthropic" (Claude direto, default) ou "deepseek" (via endpoint compativel api.deepseek.com/anthropic, requer DEEPSEEK_API_KEY configurada). Nao afeta os fluxos que ja usam Gemini (OCR de imagem, transcricao de chamada, roteirista) nem os call sites de visao (extracao de documento de viagem/financeiro), que ficam de fora ate uma fase futura.'
)
on conflict (key) do nothing;
