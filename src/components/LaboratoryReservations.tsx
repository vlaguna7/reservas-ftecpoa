import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronRight, X, FlaskConical } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Reservation {
  id: string;
  user_id: string;
  reservation_date: string;
  observation?: string;
  equipment_type: string;
  display_name: string;
}

export function LaboratoryReservations() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchReservations();

    // Configurar realtime updates
    const channelName = `laboratory-reservations-${Date.now()}`;
    console.log('📡 LaboratoryReservations: Creating channel:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          filter: 'equipment_type=like.*laboratory*'
        },
        (payload) => {
          console.log('🔄 LaboratoryReservations: Real-time change detected:', payload);
          fetchReservations();
        }
      )
      .subscribe((status) => {
        console.log('📡 LaboratoryReservations realtime status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchReservations = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        user_id,
        reservation_date,
        observation,
        equipment_type,
        profiles!inner(display_name)
      `)
      .like('equipment_type', 'laboratory%')
      .order('reservation_date', { ascending: true });

    if (error) {
      console.error('Error fetching laboratory reservations:', error);
      toast({
        title: "Erro ao carregar reservas",
        description: "Não foi possível carregar as reservas de laboratório.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }

    const formattedReservations: Reservation[] = data.map((reservation: any) => ({
      id: reservation.id,
      user_id: reservation.user_id,
      reservation_date: reservation.reservation_date,
      observation: reservation.observation,
      equipment_type: reservation.equipment_type,
      display_name: reservation.profiles.display_name
    }));

    setReservations(formattedReservations);
    setLoading(false);
  };

  const getLaboratoryName = (equipmentType: string) => {
    // Extrair o nome do laboratório do equipment_type
    return equipmentType.replace('laboratory_', '').replace(/_/g, ' ').toUpperCase();
  };

  const cancelReservation = async (reservationId: string) => {
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
    } else {
      toast({
        title: "Reserva cancelada",
        description: "A reserva foi cancelada com sucesso."
      });
      fetchReservations();
    }
  };

  const canCancelReservation = (reservation: Reservation) => {
    return user && (reservation.user_id === user.id || profile?.is_admin);
  };

  const getStatusBadge = (date: string) => {
    const today = new Date();
    const reservationDate = new Date(date);
    
    // Comparar apenas as datas, ignorando horário
    today.setHours(0, 0, 0, 0);
    reservationDate.setHours(0, 0, 0, 0);
    
    if (reservationDate.getTime() === today.getTime()) {
      return <Badge variant="default">Hoje</Badge>;
    } else if (reservationDate > today) {
      return <Badge variant="secondary">Agendado</Badge>;
    } else {
      return <Badge variant="outline">Finalizado</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Reservas de Laboratórios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Reservas de Laboratórios ({reservations.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                )}
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-3 pt-4">
              {reservations.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhuma reserva de laboratório encontrada.
                </p>
              ) : (
                reservations.map((reservation) => (
                  <div key={reservation.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-primary">
                          {getLaboratoryName(reservation.equipment_type)}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {reservation.display_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(reservation.reservation_date)}
                        {canCancelReservation(reservation) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground">
                                <X className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancelar Reserva</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja cancelar a reserva?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Não</AlertDialogCancel>
                                <AlertDialogAction onClick={() => cancelReservation(reservation.id)}>
                                  Sim, cancelar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>Data:</strong> {format(new Date(reservation.reservation_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                      {reservation.observation && (
                        <p className="text-sm">
                          <strong>Observação:</strong> {reservation.observation}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>
    </Card>
  );
}