import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Projector, Speaker, Trash2, CheckCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Reservation {
  id: string;
  equipment_type: string;
  reservation_date: string;
  created_at: string;
}

export function MyReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    if (!user) return;

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', user.id)
      .gte('reservation_date', format(twoDaysAgo, 'yyyy-MM-dd'))
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reservations:', error);
      toast({
        title: "Erro ao carregar reservas",
        description: error.message,
        variant: "destructive"
      });
    } else {
      console.log('Reservations data:', data); // Debug log
      setReservations(data || []);
    }

    setLoading(false);
  };

  const cancelReservation = async (reservationId: string) => {
    try {
      console.log('Attempting to cancel reservation:', reservationId);
      
      const { data, error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId)
        .select(); // Retornar dados para confirmar a deleção

      console.log('Delete result:', { data, error });

      if (error) {
        console.error('Error canceling reservation:', error);
        toast({
          title: "Erro ao cancelar reserva",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      if (data && data.length > 0) {
        console.log('Reservation successfully deleted:', data[0]);
        toast({
          title: "Reserva cancelada",
          description: "Sua reserva foi cancelada com sucesso."
        });
        
        // Forçar atualização imediata dos dados
        await fetchReservations();
        
        // Pequeno delay e segunda atualização para garantir sincronização
        setTimeout(async () => {
          await fetchReservations();
        }, 500);
        
      } else {
        console.error('No data returned from delete operation');
        toast({
          title: "Erro ao cancelar reserva",
          description: "A reserva não pôde ser encontrada ou já foi cancelada.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Exception in cancelReservation:', error);
      toast({
        title: "Erro ao cancelar reserva",
        description: "Erro interno. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'projector':
        return <Projector className="h-4 w-4" />;
      case 'speaker':
        return <Speaker className="h-4 w-4" />;
      default:
        return <Projector className="h-4 w-4" />;
    }
  };

  const getEquipmentLabel = (type: string) => {
    switch (type) {
      case 'projector':
        return 'Projetor';
      case 'speaker':
        return 'Caixa de Som';
      case 'auditorium':
        return 'Auditório';
      default:
        return type.startsWith('laboratory_') ? 'Laboratório' : type;
    }
  };

  const getEquipmentColor = (type: string) => {
    switch (type) {
      case 'projector':
        return 'bg-blue-100 text-blue-800';
      case 'speaker':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isReservationFinished = (reservationDate: string) => {
    const today = new Date();
    const todayDay = today.getDay(); // 0 = domingo, 6 = sábado
    const reservationDay = parseISO(reservationDate + 'T00:00:00');
    const reservationDayOfWeek = reservationDay.getDay();
    
    // Se a reserva foi feita para segunda-feira (1) e hoje é segunda, terça ou quarta
    // verificar se foi agendada no fim de semana anterior
    if (reservationDayOfWeek === 1) { // Segunda-feira
      const weekendBefore = new Date(reservationDay);
      weekendBefore.setDate(weekendBefore.getDate() - 1); // Domingo anterior
      
      // Se hoje é depois da data da reserva, é finalizada
      // EXCETO se foi agendada no fim de semana para segunda
      if (isBefore(reservationDay, startOfDay(today))) {
        return true;
      }
    } else {
      // Para outras datas, verificar se passou
      if (isBefore(reservationDay, startOfDay(today))) {
        return true;
      }
    }
    
    return false;
  };

  const canCancelReservation = (reservationDate: string) => {
    return !isReservationFinished(reservationDate);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="text-center py-8">
        <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          Nenhuma reserva encontrada
        </h3>
        <p className="text-sm text-muted-foreground">
          Você ainda não fez nenhuma reserva. Clique em "Fazer Reserva" para começar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reservations.map((reservation) => {
        // Parse the date string safely to avoid timezone issues
        console.log('Raw reservation_date:', reservation.reservation_date); // Debug log
        const reservationDate = parseISO(reservation.reservation_date + 'T00:00:00');
        console.log('Parsed reservationDate:', reservationDate); // Debug log
        const dayOfWeek = format(reservationDate, 'EEEE', { locale: ptBR });
        const formattedDate = format(reservationDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
        const isFinished = isReservationFinished(reservation.reservation_date);

        return (
          <Card key={reservation.id} className={isFinished ? 'opacity-75' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {isFinished && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {getEquipmentIcon(reservation.equipment_type)}
                    <span className="font-medium">
                      {getEquipmentLabel(reservation.equipment_type)}
                    </span>
                    <Badge className={getEquipmentColor(reservation.equipment_type)}>
                      {getEquipmentLabel(reservation.equipment_type)}
                    </Badge>
                    {isFinished && (
                      <Badge className="bg-green-100 text-green-800">
                        Finalizado
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="capitalize">{dayOfWeek}, {formattedDate}</span>
                  </div>
                </div>
                
                {canCancelReservation(reservation.reservation_date) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar Reserva</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja cancelar esta reserva? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Voltar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => cancelReservation(reservation.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Cancelar Reserva
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}