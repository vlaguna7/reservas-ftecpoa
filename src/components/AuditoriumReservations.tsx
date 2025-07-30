import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, Calendar, ChevronDown, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AuditoriumReservation {
  id: string;
  reservation_date: string;
  observation: string;
  created_at: string;
  user_profile: {
    display_name: string;
  };
}

export function AuditoriumReservations() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState<AuditoriumReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const fetchAuditoriumReservations = async () => {
    try {
      // Buscar todas as reservas do auditório a partir de hoje (sem limitação de data futura)
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('id, reservation_date, observation, user_id, created_at')
        .eq('equipment_type', 'auditorium')
        .gte('reservation_date', todayStr)
        .order('reservation_date', { ascending: true });

      if (reservationError) {
        console.error('Error fetching auditorium reservations:', reservationError);
        return;
      }

      if (!reservationData || reservationData.length === 0) {
        setReservations([]);
        return;
      }

      // Buscar perfis dos usuários
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
        reservation_date: reservation.reservation_date,
        observation: reservation.observation || '',
        created_at: reservation.created_at,
        user_profile: {
          display_name: profileMap.get(reservation.user_id)?.display_name || 'Professor não identificado'
        }
      }));

      setReservations(combinedData);
    } catch (error) {
      console.error('Error fetching auditorium reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditoriumReservations();

    // Configurar realtime updates
    const channelName = `auditorium-reservations-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: 'equipment_type=eq.auditorium'
        },
        (payload) => {
          console.log('🔄 AuditoriumReservations: Real-time change detected:', payload);
          setTimeout(() => {
            fetchAuditoriumReservations();
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const cancelReservation = async (reservationId: string) => {
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId);

      if (error) {
        toast({
          title: "Erro ao cancelar reserva",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Reserva cancelada!",
        description: "A reserva do auditório foi cancelada com sucesso."
      });
      
      await fetchAuditoriumReservations();
    } catch (error) {
      console.error('Exception in cancelReservation:', error);
      toast({
        title: "Erro ao cancelar reserva",
        description: "Erro interno. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const canUserCancelReservation = (reservation: AuditoriumReservation) => {
    // Administradores podem cancelar qualquer reserva
    if (profile?.is_admin) {
      return true;
    }
    // Usuários normais só podem cancelar suas próprias reservas
    return user && reservation.user_profile?.display_name === profile?.display_name;
  };

  const toggleExpanded = (reservationId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reservationId)) {
        newSet.delete(reservationId);
      } else {
        newSet.add(reservationId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Reservas do Auditório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Carregando reservas do auditório...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Reservas do Auditório
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Todas as reservas futuras do auditório
        </p>
      </CardHeader>
      <CardContent>
        {reservations.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma reserva do auditório encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((reservation) => (
              <div key={reservation.id} className="border rounded-lg">
                <Collapsible
                  open={expandedItems.has(reservation.id)}
                  onOpenChange={() => toggleExpanded(reservation.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-4 h-auto"
                    >
                      <div className="flex items-center gap-3 text-left">
                        <Calendar className="h-4 w-4 text-primary" />
                        <div>
                          <div className="font-medium">
                            {format(new Date(reservation.reservation_date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {reservation.user_profile.display_name}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canUserCancelReservation(reservation) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelReservation(reservation.id);
                            }}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 h-6 w-6"
                            title="Cancelar reserva"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                        {expandedItems.has(reservation.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 border-t bg-muted/20">
                      <div className="mt-3">
                        <h4 className="font-medium text-sm mb-2">Observação:</h4>
                        <div className="bg-white p-3 rounded border text-sm">
                          {reservation.observation || 'Nenhuma observação fornecida.'}
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        <span className="font-medium">Reserva feita em:</span>{" "}
                        {format(new Date(reservation.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}