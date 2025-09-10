import { useState, useEffect, useMemo } from 'react';
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
import { Calendar, Projector, Speaker, AlertCircle, X, HelpCircle, Building, FlaskConical, FileText } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
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

interface FAQ {
  id: string;
  question: string;
  answer: string;
  is_active: boolean;
  sort_order: number;
}

interface LaboratoryAvailabilityResult {
  available: boolean;
  is_laboratory: boolean;
  laboratory_name?: string;
  reserved_by?: string;
  reservation_date?: string;
  created_at?: string;
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
  const [faqs, setFaqs] = useState<FAQ[]>([]);
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

  // Função reutilizável para disparar confetes
  const triggerConfetti = async () => {
    const confetti = await import('canvas-confetti');
    
    // Confetes em múltiplas rajadas para efeito mais impressionante
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

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
  };

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
    fetchFaqs();

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

  const fetchFaqs = async () => {
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching FAQs:', error);
      return;
    }

    setFaqs(data || []);
  };

  const fetchAvailability = async () => {
    console.log('📊 Fetching availability for dates:', availableDates.map(d => d.date));
    const dateList = availableDates.map(d => d.date);
    
    const counts: Record<string, ReservationCount> = {};
    
    // Inicializar contadores para cada data
    dateList.forEach(date => {
      counts[date] = { projector_count: 0, speaker_count: 0, auditorium_count: 0 };
    });

    // Buscar disponibilidade para cada equipamento usando função segura
    for (const date of dateList) {
      for (const equipment of ['projector', 'speaker', 'auditorium']) {
        try {
          const { data, error } = await supabase
            .rpc('check_reservation_availability_secure', {
              p_equipment_type: equipment,
              p_date: date
            });

          if (error) {
            console.error(`❌ Error fetching ${equipment} availability for ${date}:`, error);
            continue;
          }

          // Somar reservas para este equipamento e data
          const totalReservations = data?.reduce((sum, item) => sum + (item.reserved_count || 0), 0) || 0;
          
          if (equipment === 'projector') {
            counts[date].projector_count = totalReservations;
          } else if (equipment === 'speaker') {
            counts[date].speaker_count = totalReservations;
          } else if (equipment === 'auditorium') {
            counts[date].auditorium_count = totalReservations;
          }
        } catch (err) {
          console.error(`💥 Unexpected error checking ${equipment} availability:`, err);
        }
      }
    }

    console.log('📊 Calculated counts using secure function:', counts);
    setAvailability(counts);
  };

  const fetchUserReservations = async () => {
    if (!user) return;
    
    const dateList = availableDates.map(d => d.date);
    
    const { data, error } = await supabase
      .from('reservations')
      .select('id, reservation_date, equipment_type, time_slots, observation, user_id')
      .eq('user_id', user.id)
      .in('reservation_date', dateList);

    if (error) {
      console.error('Error fetching user reservations:', error);
      return;
    }

    // Validação dupla - garantir que todos os dados retornados são do usuário atual
    const validatedData = data.filter(reservation => reservation.user_id === user.id);

    const userRes: Record<string, any[]> = {};
    dateList.forEach(date => {
      userRes[date] = [];
    });

    validatedData.forEach(reservation => {
      const dateStr = reservation.reservation_date;
      userRes[dateStr].push({
        id: reservation.id,
        equipment_type: reservation.equipment_type,
        time_slots: reservation.time_slots,
        observation: reservation.observation,
        user_id: reservation.user_id
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
    if (!user) return false;
    return userReservations[date]?.some(res => 
      res.equipment_type === equipment && res.user_id === user.id
    ) || false;
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
    if (!user) return false;
    const available = getAvailabilityForDate(date, equipment);
    const userAlreadyHasReservation = userReservations[date]?.some(res => 
      res.equipment_type === equipment && res.user_id === user.id
    ) || false;
    return available !== null && available > 0 && !userAlreadyHasReservation;
  };

  const checkAuditoriumAvailability = async (date: string, timeSlots: string[], excludeCurrentUser = false) => {
    console.log('🔍 Verificando disponibilidade para:', { date, timeSlots, excludeCurrentUser });
    
    try {
      // Usar função segura para verificar disponibilidade
      const { data, error } = await supabase
        .rpc('check_reservation_availability_secure', {
          p_equipment_type: 'auditorium',
          p_date: date
        });

      if (error) {
        console.error('Error checking auditorium availability:', error);
        return { available: false, conflictingSlots: [] };
      }

      console.log('🔍 Reservas encontradas via função segura:', data);

      if (!data || data.length === 0) {
        console.log('✅ Nenhuma reserva encontrada - horários disponíveis');
        return { available: true, conflictingSlots: [] };
      }

      // Verificar conflitos de horários
      const existingSlots = data.flatMap(reservation => reservation.time_slots || []);
      console.log('🔍 Horários já reservados:', existingSlots);
      
      const conflictingSlots = timeSlots.filter(slot => existingSlots.includes(slot));
      console.log('⚠️ Conflitos encontrados:', conflictingSlots);
      
      return {
        available: conflictingSlots.length === 0,
        conflictingSlots,
        existingSlots // Retornar os horários existentes para verificação
      };
    } catch (err) {
      console.error('💥 Unexpected error checking auditorium availability:', err);
      return { available: false, conflictingSlots: [] };
    }
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

  // Verificar se usuário tem reserva existente de auditório
  const hasExistingAuditoriumReservation = useMemo(() => {
    if (!auditoriumDate || !user) return false;
    const dateStr = formatDateToLocalString(auditoriumDate);
    const auditoriumReservation = userReservations[dateStr]?.find(res => res.equipment_type === 'auditorium');
    console.log('🔍 VERIFICAÇÃO RESERVA EXISTENTE - Data:', dateStr);
    console.log('🔍 VERIFICAÇÃO RESERVA EXISTENTE - Reservas para data:', userReservations[dateStr]);
    console.log('🔍 VERIFICAÇÃO RESERVA EXISTENTE - Reserva auditório encontrada:', auditoriumReservation);
    return !!auditoriumReservation;
  }, [auditoriumDate, userReservations, user]);

  const confirmAuditoriumReservation = async () => {
    if (!auditoriumDate || selectedTimeSlots.length === 0) {
      setAuditoriumError('Por favor, selecione uma data e pelo menos um horário.');
      return;
    }

    try {
      setLoading(true);
      const dateStr = formatDateToLocalString(auditoriumDate);
      
      console.log('🔄 Iniciando processo de reserva...');
      console.log('🔄 Data selecionada:', auditoriumDate);
      console.log('🔄 Data formatada para envio:', dateStr);
      console.log('🔄 Horários selecionados:', selectedTimeSlots);
      console.log('🔄 Usuário:', user?.id);
      
      // Verificar se o usuário já tem uma reserva para esta data
      const { data: existingReservations, error: checkError } = await supabase
        .from('reservations')
        .select('id, time_slots, observation')
        .eq('user_id', user.id)
        .eq('equipment_type', 'auditorium')
        .eq('reservation_date', dateStr);

      console.log('🔍 Reservas existentes encontradas:', existingReservations);
      
      if (checkError) {
        console.error('❌ Erro ao verificar reservas existentes:', checkError);
        throw checkError;
      }

      const hasExistingReservation = existingReservations && existingReservations.length > 0;
      
      // NOVA LÓGICA: Se já tem reserva, bloquear e pedir para cancelar
      if (hasExistingReservation) {
        console.log('🚫 Usuário já tem reserva - bloqueando nova reserva');
        setAuditoriumError('Você já possui uma reserva de auditório para esta data. Para modificar sua reserva, primeiro cancele a reserva atual em "Minhas Reservas" e depois faça uma nova reserva com os horários desejados.');
        return;
      }

      // Sempre exigir observação para novas reservas
      if (!auditoriumObservation.trim()) {
        setAuditoriumError('Por favor, adicione uma observação.');
        return;
      }
      
      // Se não há reserva existente, exigir observação
      if (!hasExistingReservation && !auditoriumObservation.trim()) {
        setAuditoriumError('Por favor, adicione uma observação.');
        return;
      }

      // Verificar conflitos com outros usuários (excluindo o próprio usuário)
      const { data: otherReservations, error: otherError } = await supabase
        .from('reservations')
        .select('time_slots')
        .eq('equipment_type', 'auditorium')
        .eq('reservation_date', dateStr)
        .neq('user_id', user.id);

      if (otherError) {
        console.error('❌ Erro ao verificar reservas de outros usuários:', otherError);
        throw otherError;
      }

      // Verificar se há conflitos com outros usuários
      const otherUsersSlots = otherReservations?.flatMap(res => res.time_slots || []) || [];
      const conflictingSlots = selectedTimeSlots.filter(slot => otherUsersSlots.includes(slot));
      
      if (conflictingSlots.length > 0) {
        const conflictingLabels = conflictingSlots.map(slot => 
          TIME_SLOTS.find(ts => ts.value === slot)?.label
        ).join(', ');
        setAuditoriumError(`Os seguintes horários já estão reservados por outros usuários: ${conflictingLabels}.`);
        return;
      }

      // Criar nova reserva (lógica simplificada - sem atualização de reservas existentes)
      console.log('➕ Criando nova reserva...');
      const { data, error } = await supabase
        .from('reservations')
        .insert({
          user_id: user.id,
          equipment_type: 'auditorium',
          reservation_date: dateStr,
          observation: auditoriumObservation.trim(),
          time_slots: selectedTimeSlots
        })
        .select();

      console.log('➕ Resultado da criação:', { data, error });

      if (error) {
        console.error('❌ Erro na criação:', error);
        throw error;
      }
      
      const result = data?.[0];
      
      // Email notifications have been removed for security reasons
      console.log('✅ Reservation created successfully:', result);
      
      const selectedLabels = selectedTimeSlots.map(slot => 
        TIME_SLOTS.find(ts => ts.value === slot)?.label
      ).join(', ');

      // Disparar confetes para reserva de auditório
      triggerConfetti();

      toast({
        title: "Reserva confirmada!",
        description: `Auditório reservado para ${format(auditoriumDate, "dd/MM/yyyy", { locale: ptBR })} nos horários: ${selectedLabels}.`,
        className: "bg-blue-900 border-blue-800 text-white [&>*]:text-white animate-scale-in"
      });

      console.log('✅ Reserva processada com sucesso:', result);

      // Reset form
      setAuditoriumDate(undefined);
      setAuditoriumObservation('');
      setAuditoriumError('');
      setSelectedTimeSlots([]);
      setShowAuditoriumObservation(false);
      
      // Não fazer reload da página - deixar o realtime atualizar
      console.log('🔄 Reserva concluída - aguardando atualizações do realtime...');
      
    } catch (error: any) {
      console.error('❌ Erro no processo de reserva:', error);
      setAuditoriumError(error.message || 'Erro ao processar reserva. Tente novamente.');
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
      
      console.log('🔍 Confirmar reserva de laboratório:', { 
        selectedLaboratory, 
        laboratoryDate, 
        dateStr,
        needsSupplies,
        observation: laboratoryObservation
      });

      // Verificar disponibilidade em tempo real usando nova função
      const { data: availabilityCheck, error: availabilityError } = await supabase
        .rpc('check_laboratory_availability_real_time', {
          p_equipment_type: selectedLaboratory,
          p_reservation_date: dateStr
        });

      if (availabilityError) {
        console.error('Erro ao verificar disponibilidade:', availabilityError);
        toast({
          title: "Erro",
          description: "Erro ao verificar disponibilidade. Tente novamente.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Cast do resultado e verificar se não está disponível
      const availabilityResult = availabilityCheck as unknown as LaboratoryAvailabilityResult;
      if (!availabilityResult?.available) {
        const labName = availabilityResult?.laboratory_name || laboratoryNames[selectedLaboratory] || selectedLaboratory;
        const reservedBy = availabilityResult?.reserved_by || 'outro usuário';
        setLaboratoryError(`O laboratório ${labName} já está reservado para esta data por ${reservedBy}. Por favor, escolha outra data.`);
        setLoading(false);
        return;
      }

      const observation = needsSupplies 
        ? laboratoryObservation.trim()
        : 'Não deseja insumos extras.';

      // Reservar o laboratório com retry em caso de conflito
      const maxRetries = 3;
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          const { data, error } = await supabase
            .from('reservations')
            .insert({
              user_id: user.id,
              equipment_type: selectedLaboratory,
              reservation_date: dateStr,
              observation: observation
            })
            .select();

          if (error) {
            // Se for erro de duplicata/conflict, tentar novamente
            if (error.code === '23505' || error.message.includes('já está reservado') || error.message.includes('unique')) {
              console.log(`🔄 Tentativa ${retryCount + 1} falhou por conflito, tentando novamente...`);
              retryCount++;
              if (retryCount < maxRetries) {
                // Aguardar um pouco antes de tentar novamente
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
              } else {
                // Máximo de tentativas atingido
                const labName = laboratoryNames[selectedLaboratory] || selectedLaboratory;
                setLaboratoryError(`O laboratório ${labName} foi reservado por outro usuário enquanto você fazia a reserva. Por favor, escolha outra data.`);
                setLoading(false);
                return;
              }
            } else {
              // Outro tipo de erro
              throw error;
            }
          } else {
            // Sucesso!
            console.log('✅ Reserva de laboratório criada com sucesso:', data);
            
            // Enviar notificação por email em background (não espera concluir)
            const result = data?.[0];
            if (result) {
              setTimeout(() => {
              console.log('✅ Laboratory reservation created successfully:', result);
              }, 100); // Envia email após 100ms sem bloquear a UI
            }

            const laboratoryName = laboratoryOptions.find(lab => lab.value === selectedLaboratory)?.label || 'Laboratório';

            // Disparar confetes para reserva de laboratório
            triggerConfetti();

            toast({
              title: "Reserva confirmada!",
              description: `${laboratoryName} reservado para ${format(laboratoryDate, "dd/MM/yyyy", { locale: ptBR })}.`,
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

            // Reset form
            setSelectedLaboratory('');
            setLaboratoryDate(undefined);
            setNeedsSupplies(null);
            setLaboratoryObservation('');
            setLaboratoryError('');
            break;
          }
        } catch (insertError: any) {
          console.error('❌ Erro ao criar reserva de laboratório:', insertError);
          if (retryCount >= maxRetries - 1) {
            setLaboratoryError(insertError.message || 'Erro ao criar reserva. Tente novamente.');
          }
          break;
        }
      }

    } catch (error: any) {
      console.error('💥 Erro inesperado na reserva de laboratório:', error);
      setLaboratoryError(error.message || 'Erro ao criar reserva. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Para formulário de eventos, redirecionar para sistema externo
    if (selectedEquipment === 'events-form') {
      window.open('https://eventos.unidadepoazn.app', '_blank', 'noopener,noreferrer');
      return;
    }
    
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

    const { data, error } = await supabase
      .from('reservations')
      .insert(reservationData)
      .select();

    if (error) {
      toast({
        title: "Erro ao fazer reserva",
        description: error.message,
        variant: "destructive"
      });
    } else {
      // Email notifications have been removed for security reasons
      const result = data?.[0];
      console.log('✅ Reservation created successfully:', result);
      // Disparar confetes quando a reserva for realizada com sucesso
      triggerConfetti();

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
    const { data, error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservationId)
      .select();

    if (error) {
      toast({
        title: "Erro ao cancelar reserva",
        description: error.message,
        variant: "destructive"
      });
    } else {
      // Email notifications have been removed for security reasons
      const deletedReservation = data?.[0];
      console.log('✅ Reservation cancelled successfully:', deletedReservation);
      
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
      case 'events-form':
        return <FileText className="h-4 w-4" />;
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
      case 'events-form':
        return 'Formulário de Eventos';
      default:
        return '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label className="text-base font-medium">Selecione uma opção:</Label>
        <RadioGroup value={selectedEquipment} onValueChange={setSelectedEquipment} className="mt-3">
          {['projector', 'speaker', 'auditorium', 'laboratory', 'events-form'].map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <RadioGroupItem value={type} id={type} />
              <Label htmlFor={type} className="flex items-center gap-2 cursor-pointer">
                {getEquipmentIcon(type)}
                {getEquipmentLabel(type)}
                {type === 'events-form' && (
                  <Badge className="text-[0.625rem] px-1 py-0.5 leading-tight" style={{ backgroundColor: '#153288', color: 'white', fontSize: '0.625rem' }}>
                    Novo
                  </Badge>
                )}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <div className="mt-2 text-sm text-muted-foreground">
          {selectedEquipment === 'auditorium' 
            ? 'O auditório pode ser reservado uma vez por dia por professor.'
            : selectedEquipment === 'laboratory'
            ? 'Selecione o laboratório desejado e escolha uma data para a reserva.'
            : selectedEquipment === 'events-form'
            ? ''
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
                  onSelect={async (date) => {
                    if (date) {
                      console.log('📅 SELEÇÃO - Data original do calendário:', date);
                      console.log('📅 SELEÇÃO - Data em ISO:', date.toISOString());
                      console.log('📅 SELEÇÃO - Data local string:', date.toLocaleDateString());
                      console.log('📅 SELEÇÃO - getDate():', date.getDate());
                      console.log('📅 SELEÇÃO - getMonth():', date.getMonth());
                      console.log('📅 SELEÇÃO - getFullYear():', date.getFullYear());
                      
                      console.log('📅 SELEÇÃO - formatDateToLocalString definida:', typeof formatDateToLocalString);
                      
                      try {
                        // Verificar se há reserva existente para esta nova data
                        const dateStr = formatDateToLocalString(date);
                        console.log('📅 SELEÇÃO - Data formatada:', dateStr);
                        
                        const { data: userReservations, error } = await supabase
                          .from('reservations')
                          .select('time_slots')
                          .eq('equipment_type', 'auditorium')
                          .eq('reservation_date', dateStr)
                          .eq('user_id', user?.id);
                        
                        console.log('📅 SELEÇÃO - Resultado da consulta:', { userReservations, error });
                        
                        if (error) {
                          console.error('❌ Erro na consulta de reservas:', error);
                          throw error;
                        }
                        
                        const hasExistingReservation = userReservations && userReservations.length > 0;
                        console.log('📅 Reserva existente para nova data:', hasExistingReservation);
                        
                      } catch (err) {
                        console.error('❌ Erro ao verificar reserva existente:', err);
                      }
                      
                      // Reset campos quando muda data
                      setSelectedTimeSlots([]);
                      setAuditoriumObservation('');
                      setShowAuditoriumObservation(false);
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
                  <div key={slot.value} className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                    <Checkbox
                      id={slot.value}
                      checked={selectedTimeSlots.includes(slot.value)}
                      onCheckedChange={async (checked) => {
                        console.log('🔍 CHECKBOX - Clique em horário:', slot.value, 'checked:', checked);
                        
                        if (checked === true) {
                          // Verificar se este horário já está reservado
                          const dateStr = formatDateToLocalString(auditoriumDate!);
                          console.log('🔍 CHECKBOX - Data formatada:', dateStr);
                          
                          // Buscar reservas de outros usuários para esta data
                          const { data: otherReservations, error: otherError } = await supabase
                            .from('reservations')
                            .select('time_slots')
                            .eq('equipment_type', 'auditorium')
                            .eq('reservation_date', dateStr)
                            .neq('user_id', user?.id);
                          
                          console.log('🔍 CHECKBOX - Reservas de outros usuários:', otherReservations);
                          
                          if (otherError) {
                            console.error('Erro ao verificar disponibilidade:', otherError);
                            setAuditoriumError('Erro ao verificar disponibilidade. Tente novamente.');
                            return;
                          }
                          
                          const otherUsersSlots = otherReservations?.flatMap(res => res.time_slots || []) || [];
                          console.log('🔍 CHECKBOX - Horários de outros usuários:', otherUsersSlots);
                          
                          // Verificar se outro usuário já reservou este horário
                          if (otherUsersSlots.includes(slot.value)) {
                            console.log('❌ CHECKBOX - Horário já reservado por outro usuário:', slot.value);
                            setAuditoriumError(`Este horário já está reservado por outro usuário.`);
                            return; // Impedir a seleção
                          }
                          
                          // Se chegou até aqui, pode selecionar (permitir adicionar novos turnos)
                          console.log('✅ CHECKBOX - Horário disponível, adicionando:', slot.value);
                          console.log('🔍 CHECKBOX - Horários atuais antes de adicionar:', selectedTimeSlots);
                          
                          const newTimeSlots = [...selectedTimeSlots, slot.value];
                          setSelectedTimeSlots(newTimeSlots);
                          setAuditoriumError(''); // Limpar qualquer erro anterior
                          
                          console.log('🔍 CHECKBOX - Novos horários após adição:', newTimeSlots);
                          
                          // Buscar reserva do próprio usuário para controlar observação
                          const { data: userReservations } = await supabase
                            .from('reservations')
                            .select('time_slots')
                            .eq('equipment_type', 'auditorium')
                            .eq('reservation_date', dateStr)
                            .eq('user_id', user?.id);
                          
                          console.log('🔍 CHECKBOX - Reservas do usuário:', userReservations);
                          
                          const hasExistingReservation = userReservations && userReservations.length > 0;
                          setShowAuditoriumObservation(newTimeSlots.length > 0);
                          
                          console.log('🔍 CHECKBOX - Mostrar observação?', newTimeSlots.length > 0 && !hasExistingReservation);
                        } else {
                          console.log('🔍 CHECKBOX - Removendo horário:', slot.value);
                          console.log('🔍 CHECKBOX - Horários antes da remoção:', selectedTimeSlots);
                          
                          const newTimeSlots = selectedTimeSlots.filter(s => s !== slot.value);
                          setSelectedTimeSlots(newTimeSlots);
                          setAuditoriumError(''); // Limpar erro ao deselecionar
                          
                          console.log('🔍 CHECKBOX - Horários após remoção:', newTimeSlots);
                          
                          // Verificar se há reserva existente para controlar observação
                          if (auditoriumDate) {
                            const dateStr = formatDateToLocalString(auditoriumDate);
                            const { data: userReservations } = await supabase
                              .from('reservations')
                              .select('time_slots')
                              .eq('equipment_type', 'auditorium')
                              .eq('reservation_date', dateStr)
                              .eq('user_id', user?.id);
                            
                            const hasExistingReservation = userReservations && userReservations.length > 0;
                            setShowAuditoriumObservation(newTimeSlots.length > 0);
                          }
                        }
                      }}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                    <Label 
                      htmlFor={slot.value} 
                      className="cursor-pointer flex-1 text-base font-medium select-none"
                      onClick={() => {
                        // Para melhorar a UX no mobile, permitir clicar em toda a área
                        const checkbox = document.getElementById(slot.value) as HTMLInputElement;
                        if (checkbox) {
                          checkbox.click();
                        }
                      }}
                    >
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

          {/* Mostrar erro sempre que houver, mas só mostrar observação se não houver conflitos */}
          {auditoriumError && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{auditoriumError}</AlertDescription>
            </Alert>
          )}

          {auditoriumDate && selectedTimeSlots.length > 0 && !auditoriumError && (
            <div>
              <Label className="text-base font-medium">Observação (obrigatória):</Label>
              <Textarea
                placeholder="Descreva o motivo da reserva, se precisará de equipamentos, apoio técnico, etc. (máximo 600 caracteres)"
                value={auditoriumObservation}
                onChange={(e) => {
                  setAuditoriumObservation(e.target.value);
                }}
                maxLength={600}
                className="mt-2"
                rows={4}
              />
              <div className="text-sm text-muted-foreground mt-1">
                {auditoriumObservation.length}/600 caracteres
              </div>
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
                    <Label className="text-base font-medium">Adicionar observação?</Label>
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
                      <Label className="text-base font-medium">Observação:</Label>
                      <Textarea
                        placeholder="A compra de qualquer insumo deve ser previamente combinada com o coordenador do curso"
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

      {/* Interface específica para Formulário de Eventos */}
      {selectedEquipment === 'events-form' && (
        <div className="space-y-4">
          <div className="p-4 bg-accent/50 rounded-lg border">
            <p className="text-sm text-muted-foreground mb-3">
              Novo sistema para registro de presença em eventos e palestras, com formulários integrados e recurso de geolocalização.
            </p>
          </div>
        </div>
      )}

      {/* Interface para equipamentos normais */}
      {selectedEquipment && selectedEquipment !== 'auditorium' && selectedEquipment !== 'laboratory' && selectedEquipment !== 'events-form' && (
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
                <strong className="text-green-800 text-sm">Suas reservas para este dia ({profile?.display_name || profile?.institutional_user}):</strong>
              </div>
              <div className="space-y-2">
                {userReservations[selectedDate]
                  .map((reservation, index) => (
                  <div key={reservation.id || index} className="flex items-center justify-between bg-white rounded p-2 border">
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

      {selectedEquipment && selectedEquipment !== 'auditorium' && selectedEquipment !== 'laboratory' && selectedEquipment !== 'events-form' && selectedDate && hasUserReservation(selectedDate, selectedEquipment) && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Você já possui uma reserva de {getEquipmentLabel(selectedEquipment)} para esta data.
          </AlertDescription>
        </Alert>
      )}

      {selectedEquipment && selectedEquipment !== 'auditorium' && selectedEquipment !== 'laboratory' && selectedEquipment !== 'events-form' && selectedDate && !hasUserReservation(selectedDate, selectedEquipment) && !isAvailable(selectedDate, selectedEquipment) && (
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
        (selectedEquipment === 'auditorium' ? (!auditoriumDate || selectedTimeSlots.length === 0 || !!auditoriumError || !auditoriumObservation.trim()) :
          selectedEquipment === 'laboratory' ? (!selectedLaboratory || !laboratoryDate || needsSupplies === null || (needsSupplies && !laboratoryObservation.trim())) :
          selectedEquipment === 'events-form' ? false :
          (!selectedDate || hasUserReservation(selectedDate, selectedEquipment) || !isAvailable(selectedDate, selectedEquipment)))}
        className="w-full"
      >
        {loading ? 'Reservando...' : 
         selectedEquipment === 'laboratory' ? 'Reservar Laboratório' : 
         selectedEquipment === 'events-form' ? 'Acessar Sistema de Eventos' :
         'Confirmar Reserva'}
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
            {faqs.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                Nenhuma pergunta frequente disponível no momento.
              </div>
            ) : (
              faqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent className="whitespace-pre-wrap">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))
            )}
          </Accordion>
        </CollapsibleContent>
      </Collapsible>
    </form>
  );
}
