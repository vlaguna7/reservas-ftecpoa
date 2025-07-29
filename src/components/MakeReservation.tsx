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
import { Calendar, Monitor, Speaker, AlertCircle } from 'lucide-react';

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
  const [userReservations, setUserReservations] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

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
    const dateList = availableDates.map(d => d.date);
    
    const { data, error } = await supabase
      .from('reservations')
      .select('reservation_date, equipment_type')
      .in('reservation_date', dateList);

    if (error) {
      console.error('Error fetching availability:', error);
      return;
    }

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

    setAvailability(counts);
  };

  const fetchUserReservations = async () => {
    if (!user) return;
    
    const dateList = availableDates.map(d => d.date);
    
    const { data, error } = await supabase
      .from('reservations')
      .select('reservation_date, equipment_type')
      .eq('user_id', user.id)
      .in('reservation_date', dateList);

    if (error) {
      console.error('Error fetching user reservations:', error);
      return;
    }

    const userRes: Record<string, string[]> = {};
    dateList.forEach(date => {
      userRes[date] = [];
    });

    data.forEach(reservation => {
      const dateStr = reservation.reservation_date;
      userRes[dateStr].push(reservation.equipment_type);
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
    return userReservations[date]?.includes(equipment) || false;
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
      fetchAvailability(); // Refresh availability
      fetchUserReservations(); // Refresh user reservations
    }

    setLoading(false);
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
          Você pode reservar 1 projetor e 1 caixa de som por dia.
        </div>
      </div>

      <div>
        <Label className="text-base font-medium">Data disponível para reserva:</Label>
        <div className="mt-3 space-y-3">
          {availableDates.map(({ date, label, isToday }) => (
            <Card key={date} className={`cursor-pointer transition-colors ${
              selectedDate === date ? 'ring-2 ring-primary' : ''
            } ${!selectedEquipment || !isAvailable(date, selectedEquipment) ? 'opacity-50' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="date"
                      value={date}
                      checked={selectedDate === date}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      disabled={!selectedEquipment || !isAvailable(date, selectedEquipment)}
                      className="radio"
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
                      {selectedEquipment && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {hasUserReservation(date, selectedEquipment) ? (
                            <span className="text-amber-600 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Você já tem uma reserva deste equipamento
                            </span>
                          ) : isAvailable(date, selectedEquipment) ? (
                            `${getAvailabilityForDate(date, selectedEquipment)} unidades disponíveis`
                          ) : (
                            <span className="text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Indisponível
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
        disabled={loading || !selectedEquipment || !selectedDate || !isAvailable(selectedDate, selectedEquipment)}
        className="w-full"
      >
        {loading ? 'Reservando...' : 'Confirmar Reserva'}
      </Button>
    </form>
  );
}