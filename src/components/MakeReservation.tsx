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
import { Calendar, Monitor, Speaker, AlertCircle, X, HelpCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface EquipmentSettings {
  projector_limit: number;
  speaker_limit: number;
}

interface ReservationCount {
  projector_count: number;
  speaker_count: number;
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
    const channel = supabase
      .channel('reservation-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        (payload) => {
          console.log('🔄 Reservation change detected:', payload);
          console.log('🔄 Updating availability and user reservations...');
          fetchAvailability();
          fetchUserReservations();
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status);
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
      counts[date] = { projector_count: 0, speaker_count: 0 };
    });

    data.forEach(reservation => {
      const dateStr = reservation.reservation_date;
      if (reservation.equipment_type === 'projector') {
        counts[dateStr].projector_count++;
      }
      if (reservation.equipment_type === 'speaker') {
        counts[dateStr].speaker_count++;
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

    const { projector_count, speaker_count } = availability[date];
    
    switch (equipment) {
      case 'projector':
        return equipmentSettings.projector_limit - projector_count;
      case 'speaker':
        return equipmentSettings.speaker_limit - speaker_count;
      default:
        return null;
    }
  };

  const hasUserReservation = (date: string, equipment: string) => {
    return userReservations[date]?.some(res => res.equipment_type === equipment) || false;
  };

  const isAvailable = (date: string, equipment: string) => {
    const available = getAvailabilityForDate(date, equipment);
    const userAlreadyHasReservation = hasUserReservation(date, equipment);
    return available !== null && available > 0 && !userAlreadyHasReservation;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedEquipment || !selectedDate) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, selecione o equipamento e a data.",
        variant: "destructive"
      });
      return;
    }

    if (hasUserReservation(selectedDate, selectedEquipment)) {
      toast({
        title: "Reserva já existe",
        description: `Você já possui uma reserva de ${getEquipmentLabel(selectedEquipment)} para esta data.`,
        variant: "destructive"
      });
      return;
    }

    if (!isAvailable(selectedDate, selectedEquipment)) {
      toast({
        title: "Indisponível",
        description: "Não há mais unidades disponíveis para esta data. Por favor, escolha outro dia.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    console.log('Saving reservation with date:', selectedDate); // Debug log

    const { error } = await supabase
      .from('reservations')
      .insert({
        user_id: user!.id,
        equipment_type: selectedEquipment,
        reservation_date: selectedDate
      });

    if (error) {
      toast({
        title: "Erro ao fazer reserva",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Reserva realizada!",
        description: "Sua reserva foi confirmada com sucesso."
      });
      setSelectedEquipment('');
      setSelectedDate('');
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label className="text-base font-medium">Selecione o equipamento:</Label>
        <RadioGroup value={selectedEquipment} onValueChange={setSelectedEquipment} className="mt-3">
          {['projector', 'speaker'].map((type) => (
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
          Você pode fazer 1 reserva de cada tipo de equipamento por dia (1 projetor + 1 caixa de som).
        </div>
      </div>

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

      {selectedEquipment && selectedDate && hasUserReservation(selectedDate, selectedEquipment) && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Você já possui uma reserva de {getEquipmentLabel(selectedEquipment)} para esta data.
          </AlertDescription>
        </Alert>
      )}

      {selectedEquipment && selectedDate && !hasUserReservation(selectedDate, selectedEquipment) && !isAvailable(selectedDate, selectedEquipment) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Não há mais unidades disponíveis para esta data.
          </AlertDescription>
        </Alert>
      )}

      <Button 
        type="submit" 
        disabled={loading || !selectedEquipment || !selectedDate || hasUserReservation(selectedDate, selectedEquipment) || !isAvailable(selectedDate, selectedEquipment)}
        className="w-full"
      >
        {loading ? 'Reservando...' : 'Confirmar Reserva'}
      </Button>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowFAQ(!showFAQ)}
          className="text-primary underline text-sm hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          <HelpCircle className="h-4 w-4" />
          Perguntas Frequentes
        </button>
        
        <Collapsible open={showFAQ} onOpenChange={setShowFAQ}>
          <CollapsibleContent className="mt-3">
            <div className="border rounded-lg p-4 bg-muted/50">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="item-1">
                  <AccordionTrigger className="text-left">
                    📅 Por que aparece apenas o dia de hoje para fazer a reserva?
                  </AccordionTrigger>
                  <AccordionContent>
                    As reservas são disponibilizadas diariamente para garantir que todos os professores tenham a chance de utilizar os equipamentos, como projetores e caixas de som.
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-2">
                  <AccordionTrigger className="text-left">
                    📚 Posso reservar para todas as minhas aulas do semestre?
                  </AccordionTrigger>
                  <AccordionContent>
                    No momento, não. É necessário acessar o site e realizar a reserva sempre que houver necessidade de uso do equipamento.
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-3">
                  <AccordionTrigger className="text-left">
                    🔌 O que fazer quando não houver mais projetores disponíveis para reserva?
                  </AccordionTrigger>
                  <AccordionContent>
                    Em casos essenciais, entre em contato diretamente com a Camila para verificar a possibilidade de disponibilização de um equipamento.
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="item-4">
                  <AccordionTrigger className="text-left">
                    📞 Tem alguma outra dúvida?
                  </AccordionTrigger>
                  <AccordionContent>
                    Fale com a gente pelo WhatsApp: <a href="#" className="text-primary underline hover:text-primary/80">clique aqui</a>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </form>
  );
}