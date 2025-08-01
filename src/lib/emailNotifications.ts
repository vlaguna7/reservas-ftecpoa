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

    // Buscar email do usuário através do Supabase
    const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(reservationData.user_id);
    
    if (authError || !user?.email) {
      console.error('Error fetching user email for notification:', authError);
      return;
    }

    const notificationData = {
      reservationData,
      userName: profile.display_name,
      userEmail: user.email,
      action
    };

    console.log('Sending reservation notification:', notificationData);

    // Chamar a edge function para envio de email
    const { data, error } = await supabase.functions.invoke('send-reservation-notification', {
      body: notificationData
    });

    if (error) {
      console.error('Error calling email notification function:', error);
      return;
    }

    console.log('Email notification sent successfully:', data);
  } catch (error) {
    console.error('Exception in sendReservationNotification:', error);
  }
};