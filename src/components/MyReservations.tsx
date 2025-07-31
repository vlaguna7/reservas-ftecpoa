import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Projector, Speaker, Trash2, CheckCircle, FlaskConical } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Reservation {
  id: string;
  equipment_type: string;
  reservation_date: string;
  created_at: string;
  observation?: string;
  time_slots?: string[];
}

export function MyReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [laboratories, setLaboratories] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchLaboratories();
    fetchReservations();

    // Configurar realtime updates para reservations
    const channel = supabase
      .channel('my-reservations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        (payload) => {
          console.log('🔄 MyReservations: Real-time change detected:', payload);
          // Aguardar um pouco para garantir que a operação foi concluída
          setTimeout(() => {
            fetchReservations();
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLaboratories = async () => {
    const { data, error } = await supabase
      .from('laboratory_settings')
      .select('laboratory_code, laboratory_name')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching laboratories:', error);
    } else {
      console.log('Laboratories data:', data); // Debug log
      const labMap: {[key: string]: string} = {};
      data?.forEach(lab => {
        if (lab.laboratory_code) {
          labMap[lab.laboratory_code] = lab.laboratory_name;
          console.log(`Lab mapping: ${lab.laboratory_code} -> ${lab.laboratory_name}`); // Debug log
        }
      });
      setLaboratories(labMap);
      console.log('Final laboratories map:', labMap); // Debug log
    }
  };

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
        
        // Delay adicional para sincronização completa
        setTimeout(async () => {
          await fetchReservations();
          // Força reload da página para garantir sincronização total
          window.location.reload();
        }, 1000);
        
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
      case 'auditorium':
        return <FlaskConical className="h-4 w-4" />;
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

  const getBadgeLabel = (type: string) => {
    console.log('getBadgeLabel called with type:', type); // Debug log
    console.log('Available laboratories:', laboratories); // Debug log
    
    switch (type) {
      case 'projector':
        return 'Projetor';
      case 'speaker':
        return 'Caixa de Som';
      case 'auditorium':
        return 'Auditório';
      default:
        if (type.startsWith('laboratory_')) {
          // Extrair o código do laboratório (ex: laboratory_LAB01 -> LAB01)
          const labCode = type.replace('laboratory_', '');
          console.log('Lab code extracted:', labCode); // Debug log
          // Buscar o nome real do laboratório
          const labName = laboratories[labCode];
          console.log('Lab name found:', labName); // Debug log
          return labName ? labName : `Laboratório ${labCode}`;
        }
        return type;
    }
  };

  const getEquipmentColor = (type: string) => {
    switch (type) {
      case 'projector':
        return 'bg-blue-100 text-blue-800';
      case 'speaker':
        return 'bg-green-100 text-green-800';
      case 'auditorium':
        return 'bg-purple-100 text-purple-800';
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
                    <Badge className={getEquipmentColor(reservation.equipment_type)}>
                      {getBadgeLabel(reservation.equipment_type)}
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
                  
                  {reservation.equipment_type === 'auditorium' && reservation.time_slots && reservation.time_slots.length > 0 && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground mt-1 md:variant-outline md:h-8 md:px-3"
                        >
                          Ver horários
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Horários da Reserva</DialogTitle>
                          <DialogDescription>
                            Auditório - {formattedDate}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-sm font-medium">Horários selecionados:</Label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {reservation.time_slots.map((slot) => {
                                const timeSlotLabels = {
                                  'morning': 'Manhã - 09h/12h',
                                  'afternoon': 'Tarde - 13h/18h', 
                                  'evening': 'Noite - 19h/22h'
                                };
                                return (
                                  <span key={slot} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary/10 text-primary">
                                    {timeSlotLabels[slot as keyof typeof timeSlotLabels] || slot}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                          {reservation.observation && (
                            <div>
                              <Label className="text-sm font-medium">Observação:</Label>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {reservation.observation}
                              </p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                
                {canCancelReservation(reservation.reservation_date) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
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