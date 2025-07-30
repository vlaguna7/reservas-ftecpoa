import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor, Speaker, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Reservation {
  id: string;
  equipment_type: string;
  created_at: string;
  user_profile: {
    display_name: string;
  };
}

export function TodayReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const getTodayDate = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = domingo, 6 = sábado
    
    // Se for sábado (6) ou domingo (0), mostrar segunda-feira
    if (dayOfWeek === 0) { // Domingo
      const monday = new Date(today);
      monday.setDate(monday.getDate() + 1); // Segunda-feira
      return monday;
    } else if (dayOfWeek === 6) { // Sábado
      const monday = new Date(today);
      monday.setDate(monday.getDate() + 2); // Segunda-feira
      return monday;
    }
    
    // Dias úteis, mostrar hoje
    return today;
  };

  const fetchTodayReservations = async () => {
    try {
      const targetDate = getTodayDate();
      const dateStr = format(targetDate, 'yyyy-MM-dd');
      
      console.log('Fetching reservations for date:', dateStr);

      // Primeira query: buscar reservas
      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('id, equipment_type, user_id, created_at')
        .eq('reservation_date', dateStr)
        .order('created_at', { ascending: true });

      if (reservationError) {
        console.error('Error fetching reservations:', reservationError);
        return;
      }

      if (!reservationData || reservationData.length === 0) {
        setReservations([]);
        return;
      }

      // Segunda query: buscar perfis dos usuários
      const userIds = reservationData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return;
      }

      // Combinar dados
      const profileMap = new Map(profileData?.map(p => [p.user_id, p]) || []);
      const combinedData = reservationData.map(reservation => ({
        id: reservation.id,
        equipment_type: reservation.equipment_type,
        created_at: reservation.created_at,
        user_profile: {
          display_name: profileMap.get(reservation.user_id)?.display_name || 'Professor não identificado'
        }
      }));

      console.log('Combined reservations:', combinedData);
      setReservations(combinedData);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayReservations();
    
    // Configurar realtime updates para reservas
    const channel = supabase
      .channel('today-reservations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        () => {
          console.log('Reservation change detected, refreshing...');
          fetchTodayReservations();
        }
      )
      .subscribe();
    
    // Atualizar a cada minuto para verificar mudança de dia
    const interval = setInterval(() => {
      const now = new Date();
      // Atualizar às 00:01 (início do dia)
      if (now.getHours() === 0 && now.getMinutes() <= 1) {
        fetchTodayReservations();
      }
    }, 60000); // 1 minuto

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'projector':
        return <Monitor className="h-4 w-4" />;
      case 'speaker':
        return <Speaker className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getEquipmentLabel = (type: string) => {
    switch (type) {
      case 'projector':
        return 'Projetor';
      case 'speaker':
        return 'Caixa de Som';
      default:
        return '';
    }
  };

  const targetDate = getTodayDate();
  const isWeekend = [0, 6].includes(new Date().getDay());

  // Agrupar reservas por professor
  const groupedReservations = reservations.reduce((acc, reservation) => {
    const teacherName = reservation.user_profile?.display_name || 'Professor não identificado';
    if (!acc[teacherName]) {
      acc[teacherName] = [];
    }
    acc[teacherName].push(reservation);
    return acc;
  }, {} as Record<string, Reservation[]>);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reservas de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Carregando reservas...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Reservas para {format(targetDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </CardTitle>
        {isWeekend && (
          <p className="text-sm text-muted-foreground">
            Exibindo reservas da próxima segunda-feira
          </p>
        )}
      </CardHeader>
      <CardContent>
        {Object.keys(groupedReservations).length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma reserva para hoje</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedReservations).map(([teacherName, teacherReservations]) => (
              <div key={teacherName} className="border rounded-lg p-4">
                <h3 className="font-semibold text-lg mb-3">{teacherName}</h3>
                <div className="flex flex-wrap gap-2">
                  {teacherReservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
                    >
                      {getEquipmentIcon(reservation.equipment_type)}
                      <span>{getEquipmentLabel(reservation.equipment_type)}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({format(new Date(reservation.created_at), 'HH:mm')})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}