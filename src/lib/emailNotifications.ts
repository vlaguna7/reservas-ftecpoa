import { supabase } from '@/integrations/supabase/client';

interface ReservationData {
  id: string;
  equipment_type: string;
  reservation_date: string;
  observation?: string;
  time_slots?: string[];
  user_id: string;
}

export const sendReservationNotification = async (
  reservationData: ReservationData, 
  action: 'created' | 'cancelled'
) => {
  try {
    // Buscar dados do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, institutional_user')
      .eq('user_id', reservationData.user_id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile for notification:', profileError);
      return;
    }

    // Buscar email do usuário atual logado
    const { data: authUser, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser.user?.email) {
      console.error('Error fetching user email for notification:', authError);
      return;
    }

    const notificationData = {
      reservationData,
      userName: profile.display_name,
      userEmail: authUser.user.email,
      action
    };

    console.log('🚀 [FRONTEND] Sending reservation notification:', notificationData);
    console.log('📧 [FRONTEND] Action:', action, 'Equipment:', reservationData.equipment_type);

    // Chamar a edge function para envio de email
    const { data, error } = await supabase.functions.invoke('send-reservation-notification', {
      body: notificationData
    });

    if (error) {
      console.error('❌ [FRONTEND] Error calling email notification function:', error);
      console.error('❌ [FRONTEND] Error details:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('✅ [FRONTEND] Email notification sent successfully:', data);
  } catch (error) {
    console.error('Exception in sendReservationNotification:', error);
  }
};