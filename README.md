# Althos CRM
CRM multi-tenant da Althos Performance.

Em construção. Stack: Next.js 14, Supabase, shadcn/ui.

## Setup Local

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Acesse `http://localhost:3000` no seu navegador.

## Gerar Tipos do Supabase

Sempre que alterar o banco de dados via migrations ou interface web, gere novamente os tipos TypeScript:

```bash
npx supabase gen types typescript --project-id XXX > types/supabase.ts
```
*(Substitua `XXX` pelo Reference ID do seu projeto no Supabase)*

## Super Admin

Para habilitar o modo Super Admin em um usuário, execute o seguinte SQL no editor do Supabase:

```sql
update auth.users 
set raw_user_meta_data = jsonb_set(raw_user_meta_data, '{is_super_admin}', 'true') 
where email = 'alef@althos.com.br';
```

Após executar, o usuário terá acesso à rota `/super-admin`, onde poderá impersonar qualquer organização cadastrada para fins de suporte. O modo de impersonação é auditado e possui restrições de segurança (não permite exclusão de dados ou alteração de credenciais críticas).
