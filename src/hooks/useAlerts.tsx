import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Alert {
  id: string;
  title: string;
  message: string;
  duration: number;
}

export const useAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchActiveAlerts();
    }
  }, [user]);

  const fetchActiveAlerts = async () => {
    if (!user) return;
    
    try {
      // Get all active alerts
      const { data: allAlerts, error: alertsError } = await supabase
        .from('admin_alerts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (alertsError) {
        console.error('Error fetching alerts:', alertsError);
        return;
      }

      // Get viewed alerts for this user
      const { data: viewedAlerts, error: viewedError } = await supabase
        .from('user_viewed_alerts')
        .select('alert_id')
        .eq('user_id', user.id);

      if (viewedError) {
        console.error('Error fetching viewed alerts:', viewedError);
        return;
      }

      if (allAlerts) {
        const viewedAlertIds = viewedAlerts?.map(v => v.alert_id) || [];
        const unviewedAlerts = allAlerts.filter(alert => !viewedAlertIds.includes(alert.id));
        
        setAlerts(unviewedAlerts);
        
        // Show the first unviewed alert
        if (unviewedAlerts.length > 0) {
          setCurrentAlert(unviewedAlerts[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const markAsViewed = async (alertId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('user_viewed_alerts')
        .insert({
          user_id: user.id,
          alert_id: alertId
        });

      if (error) {
        console.error('Error saving viewed alert:', error);
      }
    } catch (error) {
      console.error('Error saving viewed alert:', error);
    }
  };

  const showNextAlert = () => {
    // Find the next unviewed alert from the current alerts list
    const currentIndex = alerts.findIndex(alert => alert.id === currentAlert?.id);
    const nextAlerts = alerts.slice(currentIndex + 1);
    
    if (nextAlerts.length > 0) {
      setCurrentAlert(nextAlerts[0]);
    } else {
      setCurrentAlert(null);
    }
  };

  const closeCurrentAlert = async () => {
    if (currentAlert) {
      await markAsViewed(currentAlert.id);
      showNextAlert();
    }
  };

  return {
    currentAlert,
    closeCurrentAlert,
  };
};