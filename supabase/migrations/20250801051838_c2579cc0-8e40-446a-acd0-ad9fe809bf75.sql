-- Verificar se o secret RESEND_API_KEY está configurado
-- Este comando apenas documenta que precisamos verificar o secret no painel do Supabase

-- Para testar a função, vamos criar um teste simples
SELECT 'Verificação: A função de email deve ter acesso ao secret RESEND_API_KEY' as status;