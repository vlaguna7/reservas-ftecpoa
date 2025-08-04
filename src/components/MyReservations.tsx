import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Projector, Speaker, Trash2, CheckCircle, FlaskConical, Users, Filter } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { sendReservationNotification } from '@/lib/emailNotifications';

interface Reservation {
  id: string;
  equipment_type: string;
  reservation_date: string;
  created_at: string;
  observation?: string;
  time_slots?: string[];
  user_id?: string; // 🔐 OPCIONAL: Para consistência, mas não necessário pois já filtra no banco
}

export function MyReservations() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [laboratories, setLaboratories] = useState<{[key: string]: string}>({});
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [currentFilter, setCurrentFilter] = useState('all');

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
      setFilteredReservations(data || []);
    }

    setLoading(false);
  };

  // ===== FUNÇÃO DE CANCELAMENTO DE RESERVA (MINHAS RESERVAS) =====
  // Esta função cancela uma reserva específica do usuário atual
  // e envia notificação por e-mail para os administradores
  const cancelReservation = async (reservationId: string) => {
    try {
      console.log('🔄 Iniciando cancelamento da reserva:', reservationId);
      
      // ===== DELETAR RESERVA DO BANCO DE DADOS =====
      // Usando Supabase client para deletar a reserva específica
      // 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
      // - MySQL: DELETE FROM reservations WHERE id = ? AND user_id = ?
      // - PostgreSQL: DELETE FROM reservations WHERE id = $1 AND user_id = $2
      // - MongoDB: db.reservations.deleteOne({_id: ObjectId(id), user_id: userId})
      // - Firebase: doc(db, 'reservations', reservationId).delete()
      const { data, error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId)
        .select(); // 📝 O .select() retorna os dados deletados para uso posterior

      console.log('📊 Resultado da operação de deleção:', { data, error });

      // ===== VERIFICAR SE HOUVE ERRO NA DELEÇÃO =====
      if (error) {
        console.error('❌ Erro ao deletar reserva do banco:', error);
        toast({
          title: "Erro ao cancelar reserva",
          description: error.message,
          variant: "destructive"
        });
        return; // 🛑 Para a execução se houver erro
      }

      // ===== PROCESSAR DELEÇÃO BEM-SUCEDIDA =====
      if (data && data.length > 0) {
        console.log('✅ Reserva deletada com sucesso:', data[0]);
        
        // ===== ENVIO DE NOTIFICAÇÃO POR E-MAIL =====
        // Enviamos e-mail em background para não bloquear a interface do usuário
        // 📧 Esta função chama uma Edge Function que usa o serviço Resend.com
        // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS DE E-MAIL:
        // - Node.js + Express: criar endpoint que usa nodemailer ou sendgrid
        // - PHP: usar PHPMailer, mail() nativo ou SendGrid API
        // - Python + FastAPI: usar smtplib, sendgrid ou mailgun
        // - .NET Core: usar System.Net.Mail ou SendGrid SDK
        // - Laravel: usar Mail facade ou Notification system
        const deletedReservation = data[0];
        sendReservationNotification({
          id: deletedReservation.id,
          equipment_type: deletedReservation.equipment_type,
          reservation_date: deletedReservation.reservation_date,
          observation: deletedReservation.observation,
          time_slots: deletedReservation.time_slots,
          user_id: deletedReservation.user_id
        }, 'cancelled').catch(error => {
          // ⚠️ Capturamos erro de e-mail mas não bloqueamos o cancelamento
          // O usuário já conseguiu cancelar, mesmo que o e-mail falhe
          console.error('❌ Erro ao enviar notificação por e-mail:', error);
        });
        
        // ===== FEEDBACK POSITIVO PARA O USUÁRIO =====
        toast({
          title: "Reserva cancelada",
          description: "Sua reserva foi cancelada com sucesso."
        });
        
        // ===== ATUALIZAÇÃO DA INTERFACE =====
        // Busca novamente os dados para sincronizar a lista de reservas
        await fetchReservations();
        
        // ===== SINCRONIZAÇÃO ADICIONAL =====
        // Delay para garantir que o banco de dados processou completamente
        // e força um reload da página para sincronização total
        // 🔄 ALTERNATIVAS MAIS ELEGANTES:
        // - WebSockets para atualização em tempo real
        // - Server-Sent Events (SSE) para push de atualizações
        // - Polling periódico mais sofisticado
        // - Estado global com Redux/Zustand para sincronização
        setTimeout(async () => {
          await fetchReservations();
          // 🔄 window.location.reload() força reload completo da página
          // Em sistemas SPA modernos, prefira atualização de estado local
          window.location.reload();
        }, 1000);
        
      } else {
        // ===== CASO NENHUM DADO FOI RETORNADO =====
        // Pode acontecer se a reserva já foi deletada por outro processo
        console.error('❌ Nenhum dado retornado da operação de deleção');
        toast({
          title: "Erro ao cancelar reserva",
          description: "A reserva não pôde ser encontrada ou já foi cancelada.",
          variant: "destructive"
        });
      }
    } catch (error) {
      // ===== TRATAMENTO DE EXCEÇÕES GERAIS =====
      // Captura erros de rede, timeout, etc.
      console.error('💥 Exceção inesperada no cancelamento:', error);
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
        return <Users className="h-4 w-4" />;
      default:
        if (type.startsWith('laboratory_')) {
          return <FlaskConical className="h-4 w-4" />;
        }
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
        if (type.startsWith('laboratory_')) {
          return 'bg-orange-100 text-orange-800';
        }
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

  const applyFilter = (filter: string) => {
    setCurrentFilter(filter);
    let filtered = [...reservations];

    switch (filter) {
      case 'recent':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'projector':
        filtered = filtered.filter(r => r.equipment_type === 'projector');
        break;
      case 'speaker':
        filtered = filtered.filter(r => r.equipment_type === 'speaker');
        break;
      case 'auditorium':
        filtered = filtered.filter(r => r.equipment_type === 'auditorium');
        break;
      case 'laboratory':
        filtered = filtered.filter(r => r.equipment_type.startsWith('laboratory_'));
        break;
      case 'all':
      default:
        // No additional filtering, keep original order
        break;
    }

    // Sempre priorizar reservas em aberto (futuras) primeiro
    filtered.sort((a, b) => {
      const aIsOpen = !isReservationFinished(a.reservation_date);
      const bIsOpen = !isReservationFinished(b.reservation_date);
      
      if (aIsOpen && !bIsOpen) return -1;
      if (!aIsOpen && bIsOpen) return 1;
      
      // Se ambas têm o mesmo status (abertas ou fechadas), manter ordem existente
      return 0;
    });

    setFilteredReservations(filtered);
  };

  const getFilterLabel = () => {
    switch (currentFilter) {
      case 'recent':
        return 'Mais recentes';
      case 'oldest':
        return 'Mais antigas';
      case 'projector':
        return 'Projetor';
      case 'speaker':
        return 'Caixa de Som';
      case 'auditorium':
        return 'Auditório';
      case 'laboratory':
        return 'Laboratório';
      default:
        return 'Todos';
    }
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
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Minhas Reservas</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size={isMobile ? "icon" : "default"}>
              <Filter className="h-4 w-4" />
              {!isMobile && <span className="ml-2">{getFilterLabel()}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => applyFilter('all')}>
              Todas as reservas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => applyFilter('recent')}>
              Mais recentes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyFilter('oldest')}>
              Mais antigas
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => applyFilter('projector')}>
              <Projector className="h-4 w-4 mr-2" />
              Projetor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyFilter('speaker')}>
              <Speaker className="h-4 w-4 mr-2" />
              Caixa de Som
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyFilter('auditorium')}>
              <Users className="h-4 w-4 mr-2" />
              Auditório
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyFilter('laboratory')}>
              <FlaskConical className="h-4 w-4 mr-2" />
              Laboratório
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {filteredReservations.map((reservation) => {
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