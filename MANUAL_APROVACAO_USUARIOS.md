# Manual de Aprovação de Usuários via Supabase

## Segurança Implementada

✅ **PROTEÇÃO 100% NO BANCO DE DADOS:**
- RLS (Row Level Security) impede qualquer acesso para usuários não aprovados
- Funções SECURITY DEFINER verificam status antes de retornar dados
- verify_user_login() só retorna dados de usuários aprovados
- get_user_status() protege verificação de status
- is_admin() só considera admins aprovados

✅ **CONTROLE TOTAL NO SUPABASE:**
- Novos usuários ficam status='pending' por padrão
- Login é bloqueado até aprovação manual
- Front-end não consegue burlar validações do banco
- Logs de auditoria para todas as mudanças

## Como Aprovar Usuários

### 1. Via SQL Editor no Supabase
```sql
-- Ver usuários pendentes
SELECT user_id, display_name, institutional_user, created_at 
FROM profiles 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- Aprovar usuário específico
UPDATE profiles 
SET status = 'approved', 
    approved_by = auth.uid(), 
    approved_at = now() 
WHERE institutional_user = 'USUARIO_AQUI';

-- Aprovar múltiplos usuários
UPDATE profiles 
SET status = 'approved', 
    approved_by = auth.uid(), 
    approved_at = now() 
WHERE status = 'pending';
```

### 2. Via Interface do Supabase (Table Editor)
1. Acesse: https://supabase.com/dashboard/project/frkqhvdsrjuxgcfjbtsp/editor
2. Navegue até a tabela `profiles`
3. Filtre por `status = 'pending'`
4. Edite diretamente os registros:
   - status: 'approved'
   - approved_at: now()
   - approved_by: seu user_id

## Como Rejeitar Usuários

```sql
-- Rejeitar usuário com motivo
UPDATE profiles 
SET status = 'rejected', 
    rejection_reason = 'Motivo da rejeição aqui',
    approved_by = auth.uid(),
    approved_at = now()
WHERE institutional_user = 'USUARIO_AQUI';
```

## Consultas Úteis

### Ver Histórico de Aprovações
```sql
SELECT * FROM user_approval_audit 
ORDER BY created_at DESC 
LIMIT 10;
```

### Estatísticas de Usuários
```sql
SELECT 
  status,
  COUNT(*) as total,
  MIN(created_at) as primeiro_cadastro,
  MAX(created_at) as ultimo_cadastro
FROM profiles 
GROUP BY status;
```

### Usuários Aprovados Hoje
```sql
SELECT display_name, institutional_user, approved_at
FROM profiles 
WHERE status = 'approved' 
  AND approved_at::date = CURRENT_DATE;
```

## Links Importantes

- **SQL Editor**: https://supabase.com/dashboard/project/frkqhvdsrjuxgcfjbtsp/sql/new
- **Table Editor**: https://supabase.com/dashboard/project/frkqhvdsrjuxgcfjbtsp/editor
- **Auth Users**: https://supabase.com/dashboard/project/frkqhvdsrjuxgcfjbtsp/auth/users

## Segurança Garantida

❌ **IMPOSSÍVEL BURLAR:**
- Usuários pendentes não conseguem fazer login
- RLS bloqueia qualquer SELECT/INSERT/UPDATE para não aprovados
- Funções do banco verificam status antes de retornar dados
- Front-end não tem controle sobre aprovação
- Admin só funciona se usuário estiver aprovado

✅ **AUDITORIA COMPLETA:**
- Todas as mudanças de status são logadas
- Histórico de quem aprovou/rejeitou
- Timestamps de todas as ações
- Impossível alterar logs (RLS protegido)