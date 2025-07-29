import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Settings, Users, Calendar, Monitor, Speaker, MonitorSpeaker, Trash2, Edit3, Save, X } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface EquipmentSettings {
  id: string;
  projector_limit: number;
  speaker_limit: number;
}

interface ReservationWithProfile {
  id: string;
  equipment_type: string;
  reservation_date: string;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string;
    institutional_user: string;
  };
}

export function AdminPanel() {
  const [equipmentSettings, setEquipmentSettings] = useState<EquipmentSettings | null>(null);
  const [reservations, setReservations] = useState<ReservationWithProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [editingReservation, setEditingReservation] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    projector_limit: 0,
    speaker_limit: 0
  });
  const [editForm, setEditForm] = useState({
    display_name: '',
    institutional_user: ''
  });

  useEffect(() => {
    fetchEquipmentSettings();
    fetchAllReservations();
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
    setSettingsForm({
      projector_limit: data.projector_limit,
      speaker_limit: data.speaker_limit
    });
  };

  const fetchAllReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        equipment_type,
        reservation_date,
        created_at,
        user_id
      `)
      .order('reservation_date', { ascending: true });

    if (error) {
      console.error('Error fetching reservations:', error);
      toast({
        title: "Erro ao carregar reservas",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    // Fetch profile data separately for each reservation
    const reservationsWithProfiles = await Promise.all(
      (data || []).map(async (reservation) => {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name, institutional_user')
          .eq('user_id', reservation.user_id)
          .single();

        return {
          ...reservation,
          profiles: profileData || { display_name: 'N/A', institutional_user: 'N/A' }
        };
      })
    );

    setReservations(reservationsWithProfiles);
  };

  const updateEquipmentSettings = async () => {
    if (!equipmentSettings) return;

    setLoading(true);

    const { error } = await supabase
      .from('equipment_settings')
      .update({
        projector_limit: settingsForm.projector_limit,
        speaker_limit: settingsForm.speaker_limit
      })
      .eq('id', equipmentSettings.id);

    if (error) {
      toast({
        title: "Erro ao atualizar configurações",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Configurações atualizadas!",
        description: "Os limites de equipamentos foram salvos."
      });
      setEditingSettings(false);
      await fetchEquipmentSettings();
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
        title: "Reserva cancelada",
        description: "A reserva foi cancelada com sucesso."
      });
      fetchAllReservations();
    }
  };

  const startEditingReservation = (reservation: ReservationWithProfile) => {
    setEditingReservation(reservation.id);
    setEditForm({
      display_name: reservation.profiles.display_name,
      institutional_user: reservation.profiles.institutional_user
    });
  };

  const saveReservationChanges = async (reservationId: string, userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: editForm.display_name,
        institutional_user: editForm.institutional_user
      })
      .eq('user_id', userId);

    if (error) {
      toast({
        title: "Erro ao atualizar informações",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Informações atualizadas!",
        description: "Os dados do usuário foram salvos."
      });
      setEditingReservation(null);
      fetchAllReservations();
    }
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'projector':
        return <Monitor className="h-4 w-4" />;
      case 'speaker':
        return <Speaker className="h-4 w-4" />;
      case 'both':
        return <MonitorSpeaker className="h-4 w-4" />;
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
      case 'both':
        return 'Projetor + Caixa de Som';
      default:
        return '';
    }
  };

  const getEquipmentColor = (type: string) => {
    switch (type) {
      case 'projector':
        return 'bg-blue-100 text-blue-800';
      case 'speaker':
        return 'bg-green-100 text-green-800';
      case 'both':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Equipment Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Equipamentos
          </CardTitle>
          {!editingSettings && (
            <Button variant="outline" size="sm" onClick={() => setEditingSettings(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="projector-limit">Limite de Projetores</Label>
              {editingSettings ? (
                <Input
                  id="projector-limit"
                  type="number"
                  min="0"
                  value={settingsForm.projector_limit}
                  onChange={(e) => setSettingsForm(prev => ({ 
                    ...prev, 
                    projector_limit: parseInt(e.target.value) || 0 
                  }))}
                />
              ) : (
                <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  {equipmentSettings?.projector_limit} unidades
                </div>
              )}
            </div>
            
            <div>
              <Label htmlFor="speaker-limit">Limite de Caixas de Som</Label>
              {editingSettings ? (
                <Input
                  id="speaker-limit"
                  type="number"
                  min="0"
                  value={settingsForm.speaker_limit}
                  onChange={(e) => setSettingsForm(prev => ({ 
                    ...prev, 
                    speaker_limit: parseInt(e.target.value) || 0 
                  }))}
                />
              ) : (
                <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                  <Speaker className="h-4 w-4" />
                  {equipmentSettings?.speaker_limit} unidades
                </div>
              )}
            </div>
          </div>

          {editingSettings && (
            <div className="flex gap-2 pt-4">
              <Button onClick={updateEquipmentSettings} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button variant="outline" onClick={() => {
                setEditingSettings(false);
                setSettingsForm({
                  projector_limit: equipmentSettings?.projector_limit || 0,
                  speaker_limit: equipmentSettings?.speaker_limit || 0
                });
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Reservations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Todas as Reservas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reservations.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhuma reserva encontrada
              </h3>
              <p className="text-sm text-muted-foreground">
                Ainda não há reservas no sistema.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Dia da Semana</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((reservation) => {
                  const reservationDate = new Date(reservation.reservation_date);
                  const dayOfWeek = format(reservationDate, 'EEEE', { locale: ptBR });
                  const formattedDate = format(reservationDate, "dd/MM/yyyy", { locale: ptBR });
                  
                  return (
                    <TableRow key={reservation.id}>
                      <TableCell>
                        <div className="space-y-1">
                          {editingReservation === reservation.id ? (
                            <div className="space-y-2">
                              <Input
                                value={editForm.display_name}
                                onChange={(e) => setEditForm(prev => ({ ...prev, display_name: e.target.value }))}
                                placeholder="Nome"
                                className="h-8"
                              />
                              <Input
                                value={editForm.institutional_user}
                                onChange={(e) => setEditForm(prev => ({ ...prev, institutional_user: e.target.value }))}
                                placeholder="Usuário institucional"
                                className="h-8"
                              />
                            </div>
                          ) : (
                            <>
                              <div className="font-medium">{reservation.profiles.display_name}</div>
                              <div className="text-sm text-muted-foreground">
                                {reservation.profiles.institutional_user}
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getEquipmentColor(reservation.equipment_type)}>
                          <div className="flex items-center gap-1">
                            {getEquipmentIcon(reservation.equipment_type)}
                            {getEquipmentLabel(reservation.equipment_type)}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell>{formattedDate}</TableCell>
                      <TableCell className="capitalize">{dayOfWeek}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {editingReservation === reservation.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => saveReservationChanges(reservation.id, reservation.user_id)}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingReservation(null)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => startEditingReservation(reservation)}
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-3 w-3" />
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
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}