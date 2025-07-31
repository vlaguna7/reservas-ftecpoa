import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Projector, Speaker, AlertCircle, X, HelpCircle, Building, FlaskConical } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface EquipmentSettings {
  projector_limit: number;
  speaker_limit: number;
}

interface ReservationCount {
  projector_count: number;
  speaker_count: number;
  auditorium_count: number;
}

// Definição dos horários do auditório
const TIME_SLOTS = [
  { value: 'morning', label: 'Manhã - 09h/12h' },
  { value: 'afternoon', label: 'Tarde - 13h/18h' },
  { value: 'evening', label: 'Noite - 19h/22h' }
] as const;

export function MakeReservation() {
  const { user, profile } = useAuth();
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
  const [auditoriumCalendarOpen, setAuditoriumCalendarOpen] = useState(false);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [showAuditoriumObservation, setShowAuditoriumObservation] = useState(false);
  const [observation, setObservation] = useState('');
  
  // Estados para laboratório
  const [selectedLaboratory, setSelectedLaboratory] = useState<string>('');
  const [laboratoryDate, setLaboratoryDate] = useState<Date | undefined>();
  const [needsSupplies, setNeedsSupplies] = useState<boolean | null>(null);
  const [laboratoryObservation, setLaboratoryObservation] = useState('');
  const [laboratoryError, setLaboratoryError] = useState('');
  const [laboratoryOptions, setLaboratoryOptions] = useState<Array<{value: string, label: string, isActive: boolean}>>([]);
  const [laboratoryCalendarOpen, setLaboratoryCalendarOpen] = useState(false);
  const [laboratoryNames, setLaboratoryNames] = useState<Record<string, string>>({});
  
  const isMobile = useIsMobile();

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
    fetchActiveLaboratories();

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
            fetchActiveLaboratories(); // Atualizar laboratórios ativos também
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

  const fetchActiveLaboratories = async () => {
    const { data, error } = await supabase
      .from('laboratory_settings')
      .select('laboratory_code, laboratory_name, is_active')
      .order('laboratory_name');

    if (error) {
      console.error('Error fetching laboratories:', error);
      return;
    }

    // Ordenar todos os laboratórios numericamente (ativos e inativos juntos)
    const allLabs = data || [];
    
    // Função para extrair número do nome do laboratório para ordenação
    const extractNumber = (name: string) => {
      const match = name.match(/\d+/);
      return match ? parseInt(match[0]) : 999; // Colocar labs sem número no final
    };
    
    // Ordenar por número
    const sortedLabs = allLabs.sort((a, b) => extractNumber(a.laboratory_name) - extractNumber(b.laboratory_name));
    
    // Criar opções com informação de status
    const labOptions = sortedLabs.map(lab => ({
      value: lab.laboratory_code,
      label: lab.laboratory_name,
      isActive: lab.is_active
    }));
    
    // Criar mapeamento de códigos para nomes
    const labNames: Record<string, string> = {};
    sortedLabs.forEach(lab => {
      labNames[lab.laboratory_code] = lab.laboratory_name;
    });
    
    setLaboratoryOptions(labOptions);
    setLaboratoryNames(labNames);
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

  const checkAuditoriumAvailability = async (date: string, timeSlots: string[]) => {
    const { data, error } = await supabase
      .from('reservations')
      .select('time_slots')
      .eq('reservation_date', date)
      .eq('equipment_type', 'auditorium');

    if (error) {
      console.error('Error checking auditorium availability:', error);
      return { available: false, conflictingSlots: [] };
    }

    if (data.length === 0) {
      return { available: true, conflictingSlots: [] };
    }

    // Verificar conflitos de horários
    const existingSlots = data.flatMap(reservation => reservation.time_slots || []);
    const conflictingSlots = timeSlots.filter(slot => existingSlots.includes(slot));
    
    return {
      available: conflictingSlots.length === 0,
      conflictingSlots
    };
  };
  
  // Função para forçar data local sem problemas de timezone
  const formatDateToLocalString = (date: Date) => {
    // Abordagem mais drástica: extrair componentes e construir string diretamente
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    const dayStr = day.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString();
    
    const result = `${yearStr}-${monthStr}-${dayStr}`;
    
    console.log('🔍 DEBUG - Data recebida:', date);
    console.log('🔍 DEBUG - Dia extraído:', day);
    console.log('🔍 DEBUG - Mês extraído:', month);
    console.log('🔍 DEBUG - Ano extraído:', year);
    console.log('🔍 DEBUG - String final:', result);
    console.log('🔍 DEBUG - Timezone offset:', date.getTimezoneOffset());
    
    return result;
  };

  const confirmAuditoriumReservation = async () => {
    if (!auditoriumDate || selectedTimeSlots.length === 0 || !auditoriumObservation.trim()) {
      setAuditoriumError('Por favor, selecione uma data, pelo menos um horário e adicione uma observação.');
      return;
    }

    try {
      setLoading(true);
      const dateStr = formatDateToLocalString(auditoriumDate);
      
      console.log('Data selecionada:', auditoriumDate);
      console.log('Data formatada para envio:', dateStr);
      console.log('Horários selecionados:', selectedTimeSlots);
      
      // Verificar se os horários estão disponíveis
      const availability = await checkAuditoriumAvailability(dateStr, selectedTimeSlots);
      
      if (!availability.available) {
        const conflictingLabels = availability.conflictingSlots.map(slot => 
          TIME_SLOTS.find(ts => ts.value === slot)?.label
        ).join(', ');
        setAuditoriumError(`Os seguintes horários já estão reservados: ${conflictingLabels}. Por favor, selecione outros horários.`);
        return;
      }
      
      const { data, error } = await supabase
        .from('reservations')
        .insert({
          user_id: user.id,
          equipment_type: 'auditorium',
          reservation_date: dateStr,
          observation: auditoriumObservation.trim(),
          time_slots: selectedTimeSlots
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      const selectedLabels = selectedTimeSlots.map(slot => 
        TIME_SLOTS.find(ts => ts.value === slot)?.label
      ).join(', ');

      toast({
        title: "Reserva confirmada!",
        description: `Auditório reservado para ${format(auditoriumDate, "dd/MM/yyyy", { locale: ptBR })} nos horários: ${selectedLabels}.`
      });

      // Scroll para o meio da página na versão mobile após sucesso
      if (isMobile) {
        setTimeout(() => {
          const pageHeight = document.documentElement.scrollHeight;
          const middlePosition = pageHeight / 2;
          
          window.scrollTo({
            top: middlePosition,
            behavior: 'smooth'
          });
        }, 1500);
      }

      // Reset form
      setAuditoriumDate(undefined);
      setAuditoriumObservation('');
      setAuditoriumError('');
      setSelectedTimeSlots([]);
      setShowAuditoriumObservation(false);
    } catch (error: any) {
      console.error('Error creating auditorium reservation:', error);
      setAuditoriumError(error.message || 'Erro ao criar reserva. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const confirmLaboratoryReservation = async () => {
    if (!selectedLaboratory || !laboratoryDate) {
      setLaboratoryError('Por favor, selecione um laboratório e uma data.');
      return;
    }

    // Verificar se o laboratório está ativo
    const selectedLab = laboratoryOptions.find(lab => lab.value === selectedLaboratory);
    if (!selectedLab || !selectedLab.isActive) {
      setLaboratoryError('Este laboratório está desativado pela administração e não pode ser reservado.');
      return;
    }

    if (needsSupplies === null) {
      setLaboratoryError('Por favor, responda se precisa comprar insumos.');
      return;
    }

    if (needsSupplies && !laboratoryObservation.trim()) {
      setLaboratoryError('Para compra de insumos, adicione uma observação detalhada.');
      return;
    }

    try {
      setLoading(true);
      const dateStr = formatDateToLocalString(laboratoryDate);
      
      // Verificar se já existe reserva para este laboratório na data
      const { data: existingReservations, error: checkError } = await supabase
        .from('reservations')
        .select('id')
        .eq('equipment_type', selectedLaboratory)
        .eq('reservation_date', dateStr);

      if (checkError) {
        throw checkError;
      }

      if (existingReservations && existingReservations.length > 0) {
        setLaboratoryError('Este laboratório já está reservado para esta data. Por favor, selecione outro dia disponível.');
        return;
      }

      const observation = needsSupplies 
        ? laboratoryObservation.trim()
        : 'Não deseja insumos extras.';
      
      const { error } = await supabase
        .from('reservations')
        .insert({
          user_id: user.id,
          equipment_type: selectedLaboratory,
          reservation_date: dateStr,
          observation: observation
        });

      if (error) {
        throw error;
      }

      const laboratoryName = laboratoryOptions.find(lab => lab.value === selectedLaboratory)?.label || 'Laboratório';

      toast({
        title: "Reserva confirmada!",
        description: `${laboratoryName} reservado para ${format(laboratoryDate, "dd/MM/yyyy", { locale: ptBR })}.`
      });

      // Scroll para o meio da página na versão mobile após sucesso
      if (isMobile) {
        setTimeout(() => {
          const pageHeight = document.documentElement.scrollHeight;
          const middlePosition = pageHeight / 2;
          
          window.scrollTo({
            top: middlePosition,
            behavior: 'smooth'
          });
        }, 1500);
      }

      // Reset form
      setSelectedLaboratory('');
      setLaboratoryDate(undefined);
      setNeedsSupplies(null);
      setLaboratoryObservation('');
      setLaboratoryError('');
    } catch (error: any) {
      console.error('Error creating laboratory reservation:', error);
      setLaboratoryError(error.message || 'Erro ao criar reserva. Tente novamente.');
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

    // Para laboratório, usar função específica
    if (selectedEquipment === 'laboratory') {
      await confirmLaboratoryReservation();
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
      
      // Scroll para o meio da página na versão mobile após sucesso
      if (isMobile) {
        setTimeout(() => {
          const pageHeight = document.documentElement.scrollHeight;
          const middlePosition = pageHeight / 2;
          
          window.scrollTo({
            top: middlePosition,
            behavior: 'smooth'
          });
        }, 1500);
      }
      
      setSelectedEquipment('');
      setSelectedDate('');
      setAuditoriumDate(undefined);
      setAuditoriumObservation('');
      setObservation('');
      
      // Reset laboratory states
      setSelectedLaboratory('');
      setLaboratoryDate(undefined);
      setNeedsSupplies(null);
      setLaboratoryObservation('');
      setLaboratoryError('');
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
    if (type.startsWith('laboratory_')) {
      return <FlaskConical className="h-4 w-4" />;
    }
    
    switch (type) {
      case 'projector':
        return <Projector className="h-4 w-4" />;
      case 'speaker':
        return <Speaker className="h-4 w-4" />;
      case 'auditorium':
        return <Building className="h-4 w-4" />;
      case 'laboratory':
        return <FlaskConical className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getEquipmentLabel = (type: string) => {
    // Se for um laboratório específico, buscar o nome no mapeamento
    if (type.startsWith('laboratory_')) {
      return laboratoryNames[type] || type;
    }
    
    switch (type) {
      case 'projector':
        return 'Projetor';
      case 'speaker':
        return 'Caixa de Som';
      case 'auditorium':
        return 'Auditório';
      case 'laboratory':
        return 'Laboratório';
      default:
        return '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label className="text-base font-medium">Selecione uma opção:</Label>
        <RadioGroup value={selectedEquipment} onValueChange={setSelectedEquipment} className="mt-3">
          {['projector', 'speaker', 'auditorium', 'laboratory'].map((type) => (
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
            : selectedEquipment === 'laboratory'
            ? 'Selecione o laboratório desejado e escolha uma data para a reserva.'
            : 'Você pode fazer 1 reserva de cada tipo de equipamento por dia (1 projetor + 1 caixa de som).'
          }
        </div>
      </div>

      {/* Interface específica para auditório */}
      {selectedEquipment === 'auditorium' && (
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Selecione a data para o auditório:</Label>
            <Popover open={auditoriumCalendarOpen} onOpenChange={setAuditoriumCalendarOpen}>
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
                      console.log('📅 SELEÇÃO - Data original do calendário:', date);
                      console.log('📅 SELEÇÃO - Data em ISO:', date.toISOString());
                      console.log('📅 SELEÇÃO - Data local string:', date.toLocaleDateString());
                      console.log('📅 SELEÇÃO - getDate():', date.getDate());
                      console.log('📅 SELEÇÃO - getMonth():', date.getMonth());
                      console.log('📅 SELEÇÃO - getFullYear():', date.getFullYear());
                    }
                    setAuditoriumDate(date);
                    setAuditoriumError('');
                    setAuditoriumCalendarOpen(false);
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    date.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                  locale={ptBR}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {auditoriumDate && (
            <div>
              <Label className="text-base font-medium">Selecione os horários desejados:</Label>
              <div className="mt-2 space-y-3">
                {TIME_SLOTS.map((slot) => (
                  <div key={slot.value} className="flex items-center space-x-2">
                     <Checkbox
                      id={slot.value}
                      checked={selectedTimeSlots.includes(slot.value)}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          setSelectedTimeSlots([...selectedTimeSlots, slot.value]);
                        } else {
                          setSelectedTimeSlots(selectedTimeSlots.filter(s => s !== slot.value));
                        }
                        setAuditoriumError('');
                        
                        // Mostrar observação apenas quando algum horário for selecionado
                        const newTimeSlots = checked === true 
                          ? [...selectedTimeSlots, slot.value]
                          : selectedTimeSlots.filter(s => s !== slot.value);
                        setShowAuditoriumObservation(newTimeSlots.length > 0);
                      }}
                    />
                    <Label htmlFor={slot.value} className="cursor-pointer">
                      {slot.label}
                    </Label>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                Selecione pelo menos um horário para continuar
              </div>
            </div>
          )}

          {auditoriumDate && selectedTimeSlots.length > 0 && (
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
          )}
        </div>
      )}

      {/* Interface específica para laboratório */}
      {selectedEquipment === 'laboratory' && (
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Selecione o laboratório:</Label>
            <Select value={selectedLaboratory} onValueChange={(value) => {
              const selectedLab = laboratoryOptions.find(lab => lab.value === value);
              if (selectedLab && !selectedLab.isActive) {
                setLaboratoryError('Este laboratório está desativado pela administração e não pode ser reservado.');
                return;
              }
              setSelectedLaboratory(value);
              setLaboratoryError('');
            }}>
              <SelectTrigger className="mt-2 max-w-sm">
                <SelectValue placeholder={laboratoryOptions.length === 0 ? "Nenhum laboratório disponível" : "Escolha um laboratório"} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {laboratoryOptions.length === 0 ? (
                  <div className="p-2 text-center text-muted-foreground">
                    Nenhum laboratório cadastrado
                  </div>
                ) : (
                  laboratoryOptions.map((lab) => (
                    <SelectItem 
                      key={lab.value} 
                      value={lab.value}
                      disabled={!lab.isActive}
                      className={!lab.isActive ? "opacity-60" : ""}
                    >
                      <div className="flex flex-col">
                        <span>{lab.label}</span>
                        {!lab.isActive && (
                          <span className="text-xs text-muted-foreground">
                            Desativado pela administração
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedLaboratory && (
            <>
              <div>
                <Label className="text-base font-medium">Selecione a data:</Label>
                <Popover open={laboratoryCalendarOpen} onOpenChange={setLaboratoryCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal mt-2"
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {laboratoryDate ? format(laboratoryDate, "dd/MM/yyyy") : "Escolha uma data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={laboratoryDate}
                      onSelect={(date) => {
                        setLaboratoryDate(date);
                        setLaboratoryError('');
                        setLaboratoryCalendarOpen(false);
                      }}
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        date.setHours(0, 0, 0, 0);
                        return date < today;
                      }}
                      locale={ptBR}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {laboratoryDate && (
                <>
                  <div>
                    <Label className="text-base font-medium">Precisa comprar algum insumo para a aula?</Label>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="supplies-yes"
                          name="needsSupplies"
                          checked={needsSupplies === true}
                          onChange={() => {
                            setNeedsSupplies(true);
                            setLaboratoryError('');
                          }}
                        />
                        <Label htmlFor="supplies-yes" className="cursor-pointer">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="supplies-no"
                          name="needsSupplies"
                          checked={needsSupplies === false}
                          onChange={() => {
                            setNeedsSupplies(false);
                            setLaboratoryError('');
                          }}
                        />
                        <Label htmlFor="supplies-no" className="cursor-pointer">Não</Label>
                      </div>
                    </div>
                  </div>

                  {needsSupplies === true && (
                    <div>
                      <Label className="text-base font-medium">Observação (obrigatória para insumos):</Label>
                      <Textarea
                        placeholder="Para compra de insumos, esta aula deverá ser agendada com no mínimo 3 dias úteis de antecedência."
                        value={laboratoryObservation}
                        onChange={(e) => {
                          setLaboratoryObservation(e.target.value);
                          setLaboratoryError('');
                        }}
                        className="mt-2"
                        rows={3}
                      />
                    </div>
                  )}

                  {laboratoryError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{laboratoryError}</AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Interface para equipamentos normais */}
      {selectedEquipment && selectedEquipment !== 'auditorium' && selectedEquipment !== 'laboratory' && (
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

      {selectedEquipment && selectedEquipment !== 'auditorium' && selectedEquipment !== 'laboratory' && selectedDate && hasUserReservation(selectedDate, selectedEquipment) && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Você já possui uma reserva de {getEquipmentLabel(selectedEquipment)} para esta data.
          </AlertDescription>
        </Alert>
      )}

      {selectedEquipment && selectedEquipment !== 'auditorium' && selectedEquipment !== 'laboratory' && selectedDate && !hasUserReservation(selectedDate, selectedEquipment) && !isAvailable(selectedDate, selectedEquipment) && (
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
            selectedEquipment === 'laboratory' ? (!selectedLaboratory || !laboratoryDate || needsSupplies === null || (needsSupplies && !laboratoryObservation.trim())) :
            (!selectedDate || hasUserReservation(selectedDate, selectedEquipment) || !isAvailable(selectedDate, selectedEquipment)))}
        className="w-full"
      >
        {loading ? 'Reservando...' : selectedEquipment === 'laboratory' ? 'Reservar Laboratório' : 'Confirmar Reserva'}
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