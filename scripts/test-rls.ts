import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error("Missing Supabase credentials in environment variables.");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);

async function runRlsTests() {
  console.log("=== Starting RLS Tests ===");
  
  const email1 = `test1_${Date.now()}@example.com`;
  const email2 = `test2_${Date.now()}@example.com`;
  const password = "password123";
  
  // 1. Create two users
  console.log("Creating test users...");
  const { data: user1Data, error: err1 } = await adminClient.auth.admin.createUser({
    email: email1,
    password: password,
    email_confirm: true
  });
  
  const { data: user2Data, error: err2 } = await adminClient.auth.admin.createUser({
    email: email2,
    password: password,
    email_confirm: true
  });
  
  if (err1 || err2 || !user1Data.user || !user2Data.user) {
    console.error("Failed to create users", err1 || err2);
    process.exit(1);
  }
  
  const user1Id = user1Data.user.id;
  const user2Id = user2Data.user.id;
  
  // 2. Create organizations & memberships
  console.log("Creating organizations and memberships...");
  const { data: org1, error: orgErr1 } = await adminClient.from('organizations').insert({
    name: 'Org 1', slug: `org-1-${Date.now()}`
  }).select().single();
  
  const { data: org2, error: orgErr2 } = await adminClient.from('organizations').insert({
    name: 'Org 2', slug: `org-2-${Date.now()}`
  }).select().single();
  
  if (orgErr1 || orgErr2) {
    console.error("Failed to create orgs", orgErr1 || orgErr2);
    process.exit(1);
  }
  
  await adminClient.from('memberships').insert([
    { organization_id: org1.id, user_id: user1Id, role: 'owner' },
    { organization_id: org2.id, user_id: user2Id, role: 'owner' }
  ]);
  
  // Create sample pipelines
  const { data: p1 } = await adminClient.from('pipelines').insert({ organization_id: org1.id, name: 'P1' }).select().single();
  const { data: p2 } = await adminClient.from('pipelines').insert({ organization_id: org2.id, name: 'P2' }).select().single();
  
  const { data: ps1 } = await adminClient.from('pipeline_stages').insert({ pipeline_id: p1.id, name: 'S1', position: 1 }).select().single();
  const { data: ps2 } = await adminClient.from('pipeline_stages').insert({ pipeline_id: p2.id, name: 'S2', position: 1 }).select().single();
  
  // Create a lead in each org
  await adminClient.from('leads').insert([
    { organization_id: org1.id, pipeline_id: p1.id, stage_id: ps1.id, name: 'Lead Org 1' },
    { organization_id: org2.id, pipeline_id: p2.id, stage_id: ps2.id, name: 'Lead Org 2' }
  ]);
  
  // 3. Test RLS
  console.log("Testing RLS queries...");
  let hasFailures = false;
  
  // Client 1
  const client1 = createClient(supabaseUrl, supabaseAnonKey);
  await client1.auth.signInWithPassword({ email: email1, password });
  
  const { data: leads1 } = await client1.from('leads').select('*');
  if (leads1 && leads1.length === 1 && leads1[0].name === 'Lead Org 1') {
    console.log("✅ PASS: User 1 can only read their own leads.");
  } else {
    console.error("❌ FAIL: User 1 read incorrect leads.", leads1);
    hasFailures = true;
  }
  
  // Client 2
  const client2 = createClient(supabaseUrl, supabaseAnonKey);
  await client2.auth.signInWithPassword({ email: email2, password });
  
  const { data: leads2 } = await client2.from('leads').select('*');
  if (leads2 && leads2.length === 1 && leads2[0].name === 'Lead Org 2') {
    console.log("✅ PASS: User 2 can only read their own leads.");
  } else {
    console.error("❌ FAIL: User 2 read incorrect leads.", leads2);
    hasFailures = true;
  }
  
  // Attempt to read cross-tenant
  const { data: crossRead } = await client1.from('leads').select('*').eq('organization_id', org2.id);
  if (crossRead && crossRead.length === 0) {
    console.log("✅ PASS: User 1 cannot read User 2's leads.");
  } else {
    console.error("❌ FAIL: User 1 could read User 2's leads.", crossRead);
    hasFailures = true;
  }
  
  // Attempt to insert cross-tenant
  const { error: crossInsertError } = await client1.from('leads').insert({
    organization_id: org2.id, pipeline_id: p2.id, stage_id: ps2.id, name: 'Hacked Lead'
  });
  
  if (crossInsertError) {
    console.log("✅ PASS: User 1 cannot insert leads into User 2's org.");
  } else {
    console.error("❌ FAIL: User 1 successfully inserted lead into User 2's org.");
    hasFailures = true;
  }
  
  // Cleanup
  console.log("Cleaning up test data...");
  await adminClient.auth.admin.deleteUser(user1Id);
  await adminClient.auth.admin.deleteUser(user2Id);
  await adminClient.from('organizations').delete().in('id', [org1.id, org2.id]);
  
  if (hasFailures) {
    console.error("Some tests failed.");
    process.exit(1);
  } else {
    console.log("All RLS tests passed successfully! 🎉");
    process.exit(0);
  }
}

runRlsTests().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
