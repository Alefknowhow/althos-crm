import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function seedCatalog(orgSlug: string, niche: 'clinica' | 'infoproduto') {
  console.log(`Seeding catalog for organization: ${orgSlug} with niche: ${niche}...`);
  
  const { data: org, error: orgError } = await adminClient
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single();
  
  if (orgError || !org) {
    console.error(`Organization with slug "${orgSlug}" not found.`);
    return;
  }

  const examples = {
    clinica: [
      { name: 'Consulta Inicial', type: 'service', price_cents: 25000, duration_minutes: 60, category: 'Atendimento', description: 'Primeira consulta para avaliação geral.' },
      { name: 'Retorno', type: 'service', price_cents: 15000, duration_minutes: 30, category: 'Atendimento', description: 'Consulta de acompanhamento.' },
      { name: 'Avaliação de Pele', type: 'service', price_cents: 0, duration_minutes: 30, category: 'Estética', description: 'Avaliação gratuita para procedimentos.' },
      { name: 'Pomada Cicatrizante XYZ', type: 'product', price_cents: 8990, stock_count: 50, category: 'Produtos', sku: 'POM-001' },
      { name: 'Protetor Solar FPS 50', type: 'product', price_cents: 12000, stock_count: 20, category: 'Produtos', sku: 'PROT-50' },
    ],
    infoproduto: [
      { name: 'Mentoria Individual (1h)', type: 'service', price_cents: 50000, duration_minutes: 60, category: 'Mentoria', description: 'Sessão individual de mentoria estratégica.' },
      { name: 'Curso: Dominando o CRM', type: 'product', price_cents: 99700, category: 'Cursos', description: 'Acesso vitalício ao curso completo.' },
      { name: 'E-book: Guia de Automação', type: 'product', price_cents: 4700, category: 'E-books', description: 'Livro digital com 50 templates.' },
      { name: 'Workshop Ao Vivo', type: 'service', price_cents: 19700, duration_minutes: 120, category: 'Eventos', description: 'Participação no próximo workshop.' },
    ]
  };

  const selectedExamples = examples[niche] || examples.clinica;

  const items = selectedExamples.map(item => ({
    ...item,
    organization_id: org.id
  }));

  const { error: insertError } = await adminClient.from('products').insert(items);
  
  if (insertError) {
    console.error("Error seeding catalog:", insertError.message);
  } else {
    console.log(`Successfully seeded ${selectedExamples.length} items for ${orgSlug}!`);
  }
}

// Get arguments from command line
const slug = process.argv[2];
const niche = process.argv[3] as any;

if (!slug) {
  console.log("\nUsage: npx tsx scripts/seed-catalog-examples.ts <org-slug> [clinica|infoproduto]");
  console.log("Example: npx tsx scripts/seed-catalog-examples.ts althos clinica\n");
  process.exit(1);
}

seedCatalog(slug, niche || 'clinica').catch(err => {
  console.error("Fatal error during seeding:", err);
  process.exit(1);
});
