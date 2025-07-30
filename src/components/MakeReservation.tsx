import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Projector, Speaker, AlertCircle, X, HelpCircle, Building } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

interface EquipmentSettings {
  projector_limit: number;
  speaker_limit: number;
}

interface ReservationCount {
  projector_count: number;
  speaker_count: number;
  auditorium_count: number;
}

export function MakeReservation() {
  const { user } = useAuth();
  const [selectedEquipment, setSelectedEquipment] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [equipmentSettings, setEquipmentSettings] = useState<EquipmentSettings | null>(null);
  const [availability, setAvailability] = useState<Record<string, ReservationCount>>({});
  const [userReservations, setUserReservations] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [auditoriumDate, setAuditoriumDate] = useState<Date | undefined>();
  const [auditoriumObservation, setAuditoriumObservation] = useState('');
  const [auditoriumError, setAuditoriumError] = useState('');
  const [observation, setObservation] = useState('');

  const getAvailableDate = () => {
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

  const availableDate = getAvailableDate();
  const availableDates = [
    { 
      date: format(availableDate, 'yyyy-MM-dd'), 
      label: format(availableDate, "EEEE, dd 'de' MMMM", { locale: ptBR }),
      isToday: format(availableDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    }
  ];

  useEffect(() => {
    fetchEquipmentSettings();
    fetchAvailability();
    fetchUserReservations();

    // Configurar realtime updates para mudanças nas reservas
    const channelName = `make-reservation-${Date.now()}`;
    console.log('📡 MakeReservation: Creating channel:', channelName);
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        (payload) => {
          console.log('🔄 MakeReservation: Real-time change detected:', payload);
          console.log('🔄 MakeReservation: Event type:', payload.eventType);
          console.log('🔄 MakeReservation: Updating availability and user reservations...');
          
          // Atualizar dados com delay para garantir sincronização
          setTimeout(() => {
            fetchAvailability();
            fetchUserReservations();
          }, 100);
        }
      )
      .subscribe((status) => {
        console.log('📡 MakeReservation realtime status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ MakeReservation: Successfully subscribed to realtime updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ MakeReservation: Channel error');
        } else if (status === 'TIMED_OUT') {
          console.error('⏰ MakeReservation: Subscription timed out');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEquipmentSettings = async () => {
    const { data, error } = await supabase
      .from('equipment_settings')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching equipment settings:', error);
      return;
    }

    setEquipmentSettings(data);
  };

  const fetchAvailability = async () => {
    console.log('📊 Fetching availability for dates:', availableDates.map(d => d.date));
    const dateList = availableDates.map(d => d.date);
    
    const { data, error } = await supabase
      .from('reservations')
      .select('reservation_date, equipment_type')
      .in('reservation_date', dateList);

    if (error) {
      console.error('❌ Error fetching availability:', error);
      return;
    }

    console.log('📊 Reservation data:', data);

    const counts: Record<string, ReservationCount> = {};
    
    dateList.forEach(date => {
      counts[date] = { projector_count: 0, speaker_count: 0, auditorium_count: 0 };
    });

    data.forEach(reservation => {
      const dateStr = reservation.reservation_date;
      if (reservation.equipment_type === 'projector') {
        counts[dateStr].projector_count++;
      }
      if (reservation.equipment_type === 'speaker') {
        counts[dateStr].speaker_count++;
      }
      if (reservation.equipment_type === 'auditorium') {
        counts[dateStr].auditorium_count++;
      }
    });

    console.log('📊 Calculated counts:', counts);
    setAvailability(counts);
  };

  const fetchUserReservations = async () => {
    if (!user) return;
    
    const dateList = availableDates.map(d => d.date);
    
    const { data, error } = await supabase
      .from('reservations')
      .select('id, reservation_date, equipment_type')
      .eq('user_id', user.id)
      .in('reservation_date', dateList);

    if (error) {
      console.error('Error fetching user reservations:', error);
      return;
    }

    const userRes: Record<string, any[]> = {};
    dateList.forEach(date => {
      userRes[date] = [];
    });

    data.forEach(reservation => {
      const dateStr = reservation.reservation_date;
      userRes[dateStr].push({
        id: reservation.id,
        equipment_type: reservation.equipment_type
      });
    });

    setUserReservations(userRes);
  };

  const getAvailabilityForDate = (date: string, equipment: string) => {
    if (!equipmentSettings || !availability[date]) return null;

    const { projector_count, speaker_count, auditorium_count } = availability[date];
    
    switch (equipment) {
      case 'projector':
        return equipmentSettings.projector_limit - projector_count;
      case 'speaker':
        return equipmentSettings.speaker_limit - speaker_count;
      case 'auditorium':
        return 1 - auditorium_count; // Apenas 1 auditório disponível por dia
      default:
        return null;
    }
  };

  const hasUserReservation = (date: string, equipment: string) => {
    return userReservations[date]?.some(res => res.equipment_type === equipment) || false;
  };

  const hasUserReservationAsync = async (date: string, equipment: string) => {
    if (!user) return false;
    
    const { data, error } = await supabase
      .from('reservations')
      .select('id')
      .eq('user_id', user.id)
      .eq('reservation_date', date)
      .eq('equipment_type', equipment);
    
    if (error) {
      console.error('Error checking user reservation:', error);
      return false;
    }
    
    return data.length > 0;
  };

  const isAvailable = (date: string, equipment: string) => {
    const available = getAvailabilityForDate(date, equipment);
    const userAlreadyHasReservation = hasUserReservation(date, equipment);
    return available !== null && available > 0 && !userAlreadyHasReservation;
  };

  const checkAuditoriumAvailability = async (date: string) => {
    const { data, error } = await supabase
      .from('reservations')
      .select('user_id')
      .eq('reservation_date', date)
      .eq('equipment_type', 'auditorium');

    if (error) {
      console.error('Error checking auditorium availability:', error);
      return false;
    }

    // Se não há reservas, está disponível
    return data.length === 0;
  };
  
  // Função para garantir que a data seja tratada como timezone local
  const createLocalDate = (year: number, month: number, day: number) => {
    return new Date(year, month, day);
  };

  // Função para converter data para string garantindo timezone local
  const formatDateToLocalString = (date: Date) => {
    // Forçar o uso da data local sem conversões de timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const result = `${year}-${month}-${day}`;
    
    console.log('🗓️ Data original selecionada:', date);
    console.log('🗓️ Ano:', year, 'Mês:', month, 'Dia:', day);
    console.log('🗓️ String final formatada:', result);
    
    return result;
  };

  const confirmAuditoriumReservation = async () => {
    if (!auditoriumDate || !auditoriumObservation.trim()) {
      setAuditoriumError('Por favor, selecione uma data e adicione uma observação.');
      return;
    }

    try {
      setLoading(true);
      const dateStr = formatDateToLocalString(auditoriumDate);
      
      console.log('Data selecionada:', auditoriumDate);
      console.log('Data formatada para envio:', dateStr);
      
      // Verificar se já existe reserva para esta data
      const { data: existingReservations, error: checkError } = await supabase
        .from('reservations')
        .select('id')
        .eq('equipment_type', 'auditorium')
        .eq('reservation_date', dateStr);

      if (checkError) {
        throw checkError;
      }

      if (existingReservations && existingReservations.length > 0) {
        setAuditoriumError('Atenção: o auditório já está reservado para esta data. Por favor, selecione outro dia disponível.');
        return;
      }
      
      const { data, error } = await supabase
        .from('reservations')
        .insert({
          user_id: user.id,
          equipment_type: 'auditorium',
          reservation_date: dateStr,
          observation: auditoriumObservation.trim()
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: "Reserva confirmada!",
        description: `Auditório reservado para ${format(auditoriumDate, "dd/MM/yyyy", { locale: ptBR })}.`
      });

      // Reset form
      setAuditoriumDate(undefined);
      setAuditoriumObservation('');
      setAuditoriumError('');
    } catch (error: any) {
      console.error('Error creating auditorium reservation:', error);
      setAuditoriumError(error.message || 'Erro ao criar reserva. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Para auditório, usar função específica
    if (selectedEquipment === 'auditorium') {
      await confirmAuditoriumReservation();
      return;
    }

    if (!selectedEquipment || !selectedDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, selecione o equipamento e a data.",
        variant: "destructive"
      });
      return;
    }

    if (selectedEquipment !== 'auditorium') {
      const hasReservation = await hasUserReservationAsync(selectedDate, selectedEquipment);
      if (hasReservation) {
        toast({
          title: "Reserva já existe",
          description: `Você já possui uma reserva de ${getEquipmentLabel(selectedEquipment)} para esta data.`,
          variant: "destructive"
        });
        return;
      }

      const available = getAvailabilityForDate(selectedDate, selectedEquipment);
      if (available === null || available <= 0) {
        toast({
          title: "Indisponível",
          description: "Não há mais unidades disponíveis para esta data. Por favor, escolha outro dia.",
          variant: "destructive"
        });
        return;
      }
    }

    setLoading(true);

    const finalDate = selectedEquipment === 'auditorium' ? format(auditoriumDate!, 'yyyy-MM-dd') : selectedDate;
    console.log('Saving reservation with date:', finalDate);

    const reservationData: any = {
      user_id: user!.id,
      equipment_type: selectedEquipment,
      reservation_date: finalDate
    };

    if (observation && observation.trim()) {
      reservationData.observation = observation.trim();
    }

    const { error } = await supabase
      .from('reservations')
      .insert(reservationData);

    if (error) {
      toast({
        title: "Erro ao fazer reserva",
        description: error.message,
        variant: "destructive"
      });
    } else {
      // Disparar confetes quando a reserva for realizada com sucesso
      const confetti = await import('canvas-confetti');
      
      // Confetes em múltiplas rajadas para efeito mais impressionante
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        // Rajada da esquerda
        confetti.default({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        
        // Rajada da direita
        confetti.default({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);

      // Toast customizado com background azul marinho e letras brancas
      toast({
        title: "Reserva realizada!",
        description: "Sua reserva foi confirmada com sucesso.",
        className: "bg-blue-900 border-blue-800 text-white [&>*]:text-white animate-scale-in"
      });
      setSelectedEquipment('');
      setSelectedDate('');
      setAuditoriumDate(undefined);
      setAuditoriumObservation('');
      setObservation('');
    }

    setLoading(false);
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
        title: "Reserva cancelada!",
        description: "Sua reserva foi cancelada com sucesso."
      });
      // Atualizar dados após cancelamento
      fetchAvailability();
      fetchUserReservations();
    }
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'projector':
        return <Projector className="h-4 w-4" />;
      case 'speaker':
        return <Speaker className="h-4 w-4" />;
      case 'auditorium':
        return <Building className="h-4 w-4" />;
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
      case 'auditorium':
        return 'Auditório';
      default:
        return '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label className="text-base font-medium">Selecione o equipamento:</Label>
        <RadioGroup value={selectedEquipment} onValueChange={setSelectedEquipment} className="mt-3">
          {['projector', 'speaker', 'auditorium'].map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <RadioGroupItem value={type} id={type} />
              <Label htmlFor={type} className="flex items-center gap-2 cursor-pointer">
                {getEquipmentIcon(type)}
                {getEquipmentLabel(type)}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="mt-2 text-sm text-muted-foreground">
          {selectedEquipment === 'auditorium' 
            ? 'O auditório pode ser reservado uma vez por dia por professor.'
            : 'Você pode fazer 1 reserva de cada tipo de equipamento por dia (1 projetor + 1 caixa de som).'
          }
        </div>
      </div>

      {/* Interface específica para auditório */}
      {selectedEquipment === 'auditorium' && (
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Selecione a data para o auditório:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal mt-2"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {auditoriumDate ? format(auditoriumDate, "dd/MM/yyyy") : "Escolha uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={auditoriumDate}
                  onSelect={(date) => {
                    if (date) {
                      // Garantir que a data seja criada no timezone local
                      const localDate = createLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
                      console.log('📅 Data selecionada no calendário:', date);
                      console.log('📅 Data local criada:', localDate);
                      setAuditoriumDate(localDate);
                    } else {
                      setAuditoriumDate(date);
                    }
                    setAuditoriumError(''); // Limpar erro ao selecionar nova data
                    // Fechar automaticamente o popover após seleção
                    if (date) {
                      setTimeout(() => {
                        const closeButton = document.querySelector('[data-state="open"]');
                        if (closeButton) {
                          (closeButton as HTMLElement).click();
                        }
                      }, 100);
                    }
                  }}
                  disabled={(date) => {
                    // Permitir seleção de hoje em diante (criando datas locais)
                    const today = new Date();
                    const todayLocal = createLocalDate(today.getFullYear(), today.getMonth(), today.getDate());
                    const dateLocal = createLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
                    
                    return dateLocal < todayLocal;
                  }}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label className="text-base font-medium">Observação (obrigatória):</Label>
            <Textarea
              placeholder="Descreva o motivo da reserva, se precisará de equipamentos, apoio técnico, etc. (máximo 600 caracteres)"
              value={auditoriumObservation}
              onChange={(e) => {
                setAuditoriumObservation(e.target.value);
                setAuditoriumError(''); // Limpar erro ao digitar
              }}
              maxLength={600}
              className="mt-2"
              rows={4}
            />
            <div className="text-sm text-muted-foreground mt-1">
              {auditoriumObservation.length}/600 caracteres
            </div>
            {auditoriumError && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{auditoriumError}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}

      {/* Interface para equipamentos normais */}
      {selectedEquipment && selectedEquipment !== 'auditorium' && (
        <div>
          <Label className="text-base font-medium">Data disponível para reserva:</Label>
          <div className="mt-3 space-y-3">
            {availableDates.map(({ date, label, isToday }) => (
              <Card 
                key={date} 
                className={`cursor-pointer transition-colors ${
                  selectedDate === date ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedDate(date)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="date"
                        value={date}
                        checked={selectedDate === date}
                        onChange={() => {}} // Controlled by card click
                        className="radio pointer-events-none"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span className="font-medium capitalize">{label}</span>
                          {!isToday && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Próximo dia útil
                            </span>
                          )}
                        </div>
                        {selectedEquipment && selectedDate === date && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {hasUserReservation(date, selectedEquipment) ? (
                              <span className="text-amber-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Você já tem uma reserva de {getEquipmentLabel(selectedEquipment)}
                              </span>
                            ) : isAvailable(date, selectedEquipment) ? (
                              <span className="text-green-600 flex items-center gap-1">
                                ✓ Disponível ({getAvailabilityForDate(date, selectedEquipment)} unidades restantes)
                              </span>
                            ) : (
                              <span className="text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Indisponível (limite atingido)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {!availableDates[0].isToday && (
            <div className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
              <strong>Observação:</strong> Como hoje é fim de semana, a data disponível é o próximo dia útil (segunda-feira).
            </div>
          )}
          
          {selectedDate && userReservations[selectedDate]?.length > 0 && (
            <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <strong className="text-green-800 text-sm">Suas reservas para este dia:</strong>
              </div>
              <div className="space-y-2">
                {userReservations[selectedDate].map((reservation, index) => (
                  <div key={index} className="flex items-center justify-between bg-white rounded p-2 border">
                    <div className="flex items-center gap-2">
                      {getEquipmentIcon(reservation.equipment_type)}
                      <span className="text-sm font-medium">{getEquipmentLabel(reservation.equipment_type)}</span>
                    </div>
                    <button
                      onClick={() => cancelReservation(reservation.id)}
                      className="flex items-center justify-center w-6 h-6 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-full transition-colors border border-red-200"
                      title="Cancelar reserva"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedEquipment && selectedEquipment !== 'auditorium' && selectedDate && hasUserReservation(selectedDate, selectedEquipment) && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Você já possui uma reserva de {getEquipmentLabel(selectedEquipment)} para esta data.
          </AlertDescription>
        </Alert>
      )}

      {selectedEquipment && selectedEquipment !== 'auditorium' && selectedDate && !hasUserReservation(selectedDate, selectedEquipment) && !isAvailable(selectedDate, selectedEquipment) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Não há mais unidades disponíveis para esta data.
          </AlertDescription>
        </Alert>
      )}

      <Button 
        type="submit" 
        disabled={loading || !selectedEquipment || 
          (selectedEquipment === 'auditorium' ? (!auditoriumDate || !auditoriumObservation.trim()) : 
            (!selectedDate || hasUserReservation(selectedDate, selectedEquipment) || !isAvailable(selectedDate, selectedEquipment)))}
        className="w-full"
      >
        {loading ? 'Reservando...' : 'Confirmar Reserva'}
      </Button>

      <Collapsible open={showFAQ} onOpenChange={setShowFAQ}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full">
            <HelpCircle className="mr-2 h-4 w-4" />
            Dúvidas Frequentes
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 mt-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>📅 Por que só posso reservar para hoje ou próximo dia útil?</AccordionTrigger>
              <AccordionContent>
                Para otimizar o uso dos equipamentos e evitar reservas esquecidas, o sistema permite reservas apenas para o dia atual (durante a semana) ou próxima segunda-feira (nos fins de semana).
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>📚 Posso reservar para todas as minhas aulas do semestre?</AccordionTrigger>
              <AccordionContent>
                No momento, não. É necessário acessar o site e realizar a reserva sempre que houver necessidade de uso do equipamento.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>🔌 O que fazer quando não houver mais projetores disponíveis para reserva?</AccordionTrigger>
              <AccordionContent>
                Em casos essenciais, entre em contato diretamente com a Camila para verificar a possibilidade de disponibilização de um equipamento.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger>📅 Como reservar o auditório?</AccordionTrigger>
              <AccordionContent>
                Para reservar o auditório, selecione "Auditório" na lista de equipamentos, escolha uma data no calendário e preencha a observação obrigatória descrevendo o motivo da reserva e necessidades específicas.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
              <AccordionTrigger>📞 Tem alguma outra dúvida?</AccordionTrigger>
              <AccordionContent>
                Fale com a gente pelo WhatsApp:{" "}
                <a 
                  href="https://wa.me/5551992885496" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  clique aqui
                </a>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CollapsibleContent>
      </Collapsible>
    </form>
  );
}