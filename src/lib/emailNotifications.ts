// ===== CLIENTE SUPABASE PARA BANCO DE DADOS =====
// Importa o cliente configurado do Supabase para operações de banco
// 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
// - MySQL/PostgreSQL: import mysql2, pg, ou prisma
// - MongoDB: import mongoose ou mongodb driver 
// - Firebase: import { getFirestore } from 'firebase/firestore'
import { supabase } from '@/integrations/supabase/client';

// ===== INTERFACE DOS DADOS DA RESERVA =====
// Define a estrutura dos dados que serão enviados por e-mail
// 📝 Contém todas as informações necessárias da reserva
interface ReservationData {
  id: string;                    // ID único da reserva
  equipment_type: string;        // Tipo do equipamento (projector, auditorium, laboratory_XX)
  reservation_date: string;      // Data da reserva no formato YYYY-MM-DD
  observation?: string;          // Observação opcional do usuário
  time_slots?: string[];         // Horários para auditório (morning, afternoon, evening)
  user_id: string;              // ID do usuário que fez a reserva
}

// ===== FUNÇÃO PRINCIPAL DE ENVIO DE NOTIFICAÇÃO =====
// Esta função coordena todo o processo de envio de e-mail para administradores
// quando uma reserva é criada ou cancelada
export const sendReservationNotification = async (
  reservationData: ReservationData, 
  action: 'created' | 'cancelled'  // 📝 Ação realizada: criação ou cancelamento
) => {
  try {
    // ===== BUSCAR DADOS DO PERFIL DO USUÁRIO =====
    // Precisamos do nome do usuário para incluir no e-mail
    // 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
    // - MySQL: SELECT display_name, institutional_user FROM profiles WHERE user_id = ?
    // - MongoDB: db.profiles.findOne({user_id: reservationData.user_id})
    // - Firebase: doc(db, 'profiles', reservationData.user_id).get()
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, institutional_user')
      .eq('user_id', reservationData.user_id)
      .single();

    // ===== VALIDAR SE ENCONTROU O PERFIL =====
    if (profileError || !profile) {
      console.error('❌ Erro ao buscar perfil do usuário para notificação:', profileError);
      return; // 🛑 Para a execução se não encontrar o usuário
    }

    // ===== BUSCAR E-MAIL DO USUÁRIO AUTENTICADO =====
    // Obtém o e-mail do usuário atual do sistema de autenticação
    // 📧 Este será o "de quem" no e-mail enviado aos administradores
    // 🔄 ADAPTAÇÕES PARA OUTROS SISTEMAS DE AUTH:
    // - Firebase Auth: getAuth().currentUser?.email
    // - Auth0: useUser() hook ou Auth0 Management API
    // - AWS Cognito: getCurrentUser() e getUserAttributes()
    // - JWT customizado: decodificar token e buscar e-mail
    const { data: authUser, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser.user?.email) {
      console.error('❌ Erro ao buscar e-mail do usuário para notificação:', authError);
      return; // 🛑 Para se não conseguir obter o e-mail
    }

    // ===== PREPARAR DADOS PARA O E-MAIL =====
    // Monta objeto com todas as informações necessárias para o e-mail
    const notificationData = {
      reservationData,                    // Dados completos da reserva
      userName: profile.display_name,     // Nome do usuário
      userEmail: authUser.user.email,     // E-mail do usuário
      action                              // Ação (created/cancelled)
    };

    console.log('🚀 [FRONTEND] Enviando notificação de reserva:', notificationData);
    console.log('📧 [FRONTEND] Ação:', action, 'Equipamento:', reservationData.equipment_type);

    // ===== CONFIGURAR TIMEOUT PARA O E-MAIL =====
    // Cria uma Promise que falha após 5 segundos para evitar travamento
    // 🔄 ALTERNATIVAS:
    // - AbortController para cancelar fetch nativo
    // - Axios timeout para bibliotecas HTTP
    // - Queue de e-mails em background (Redis, Bull, etc.)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email notification timeout')), 5000)
    );
    
    // ===== CHAMAR EDGE FUNCTION PARA ENVIO DE E-MAIL =====
    // Esta é uma função serverless que processa o envio via Resend.com
    // 📧 A Edge Function cuida de:
    // - Buscar e-mails dos administradores no banco
    // - Formatar o HTML do e-mail
    // - Enviar via API do Resend respeitando rate limits
    // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
    // - Node.js: fetch('/api/send-email', {method: 'POST', body: ...})
    // - PHP: curl para endpoint interno ou serviço de e-mail
    // - Python: requests.post() para API Flask/FastAPI
    // - .NET: HttpClient.PostAsync() para endpoint ASP.NET
    const emailPromise = supabase.functions.invoke('send-reservation-notification', {
      body: notificationData
    });
    
    // ===== EXECUTAR COM TIMEOUT =====
    // Promise.race garante que se o e-mail demorar mais que 5s, vai falhar
    // Isso evita travar a interface do usuário
    const { data, error } = await Promise.race([emailPromise, timeoutPromise]) as any;

    // ===== TRATAMENTO DE ERRO NO ENVIO =====
    if (error) {
      console.error('❌ [FRONTEND] Erro ao chamar função de notificação por e-mail:', error);
      console.error('❌ [FRONTEND] Detalhes do erro:', JSON.stringify(error, null, 2));
      return; // 🛑 Para se houver erro, mas não bloqueia a reserva
    }

    // ===== SUCESSO NO ENVIO =====
    console.log('✅ [FRONTEND] Notificação por e-mail enviada com sucesso:', data);
  } catch (error) {
    // ===== TRATAMENTO DE EXCEÇÕES GERAIS =====
    // Captura qualquer erro inesperado (rede, parsing, etc.)
    // ⚠️ Importante: Este erro não deve bloquear a criação/cancelamento da reserva
    // O e-mail é um "extra", a operação principal deve continuar funcionando
    console.error('💥 Exceção na função sendReservationNotification:', error);
  }
};