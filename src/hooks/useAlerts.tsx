import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Alert {
  id: string;
  title: string;
  message: string;
  duration: number;
}

export const useAlerts = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);

  useEffect(() => {
    fetchActiveAlerts();
  }, []);

  const fetchActiveAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_alerts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching alerts:', error);
        return;
      }

      if (data) {
        // Filter out alerts that the user has already seen
        const viewedAlerts = getViewedAlerts();
        const unviewedAlerts = data.filter(alert => !viewedAlerts.includes(alert.id));
        
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

  const getViewedAlerts = (): string[] => {
    try {
      const viewed = localStorage.getItem('viewedAlerts');
      return viewed ? JSON.parse(viewed) : [];
    } catch {
      return [];
    }
  };

  const markAsViewed = (alertId: string) => {
    try {
      const viewedAlerts = getViewedAlerts();
      const updatedViewed = [...viewedAlerts, alertId];
      localStorage.setItem('viewedAlerts', JSON.stringify(updatedViewed));
    } catch (error) {
      console.error('Error saving viewed alert:', error);
    }
  };

  const closeCurrentAlert = () => {
    if (currentAlert) {
      markAsViewed(currentAlert.id);
      
      // Find next unviewed alert
      const remainingAlerts = alerts.filter(alert => alert.id !== currentAlert.id);
      setAlerts(remainingAlerts);
      
      if (remainingAlerts.length > 0) {
        setCurrentAlert(remainingAlerts[0]);
      } else {
        setCurrentAlert(null);
      }
    }
  };

  return {
    currentAlert,
    closeCurrentAlert,
  };
};