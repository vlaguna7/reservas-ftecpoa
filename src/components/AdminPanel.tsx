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
import { Settings, Users, Calendar, Projector, Speaker, MonitorSpeaker, Trash2, Edit3, Save, X, BarChart3, Download, Activity, UserCheck, UserX, Shield, ShieldOff, Key, UserMinus, FlaskConical, Power, PowerOff, Plus } from 'lucide-react';

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  institutional_user: string;
  is_admin: boolean;
  created_at: string;
}

interface SystemStats {
  totalUsers: number;
  totalReservations: number;
  totalAdmins: number;
  reservationsThisWeek: number;
  projectorReservations: number;
  speakerReservations: number;
}

interface LaboratorySetting {
  id: string;
  laboratory_code: string;
  laboratory_name: string;
  is_active: boolean;
}

export function AdminPanel() {
  const [equipmentSettings, setEquipmentSettings] = useState<EquipmentSettings | null>(null);
  const [reservations, setReservations] = useState<ReservationWithProfile[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [laboratorySettings, setLaboratorySettings] = useState<LaboratorySetting[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [editingReservation, setEditingReservation] = useState<string | null>(null);
  const [editingLaboratory, setEditingLaboratory] = useState<string | null>(null);
  const [addingLaboratory, setAddingLaboratory] = useState(false);
  const [changingPin, setChangingPin] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    projector_limit: 0,
    speaker_limit: 0
  });
  const [editForm, setEditForm] = useState({
    display_name: '',
    institutional_user: ''
  });
  const [laboratoryEditForm, setLaboratoryEditForm] = useState({
    laboratory_name: ''
  });
  const [newLaboratoryForm, setNewLaboratoryForm] = useState({
    laboratory_code: '',
    laboratory_name: ''
  });

  useEffect(() => {
    fetchEquipmentSettings();
    fetchAllReservations();
    fetchAllUsers();
    fetchLaboratorySettings();
    fetchSystemStats();
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

  const fetchAllUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    setUsers(data || []);
  };

  const fetchLaboratorySettings = async () => {
    const { data, error } = await supabase
      .from('laboratory_settings')
      .select('*')
      .order('laboratory_name', { ascending: true });

    if (error) {
      console.error('Error fetching laboratory settings:', error);
      return;
    }

    setLaboratorySettings(data || []);
  };

  const fetchSystemStats = async () => {
    try {
      // Total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Total reservations
      const { count: totalReservations } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true });

      // Total admins
      const { count: totalAdmins } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_admin', true);

      // Reservations this week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const { count: reservationsThisWeek } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo.toISOString());

      // Projector reservations
      const { count: projectorReservations } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('equipment_type', 'projector');

      // Speaker reservations
      const { count: speakerReservations } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('equipment_type', 'speaker');

      setStats({
        totalUsers: totalUsers || 0,
        totalReservations: totalReservations || 0,
        totalAdmins: totalAdmins || 0,
        reservationsThisWeek: reservationsThisWeek || 0,
        projectorReservations: projectorReservations || 0,
        speakerReservations: speakerReservations || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleUserAdmin = async (userId: string, currentAdminStatus: boolean) => {
    try {
      console.log('Toggling admin status:', { userId, currentAdminStatus, newStatus: !currentAdminStatus });
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentAdminStatus })
        .eq('user_id', userId)
        .select();

      console.log('Update result:', { data, error });

      if (error) {
        console.error('Error updating admin status:', error);
        toast({
          title: "Erro ao alterar permissão",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      if (data && data.length > 0) {
        console.log('Successfully updated user:', data[0]);
        toast({
          title: "Permissão alterada!",
          description: `Usuário ${!currentAdminStatus ? 'promovido a' : 'removido de'} administrador.`
        });
        
        // Recarregar todos os dados para garantir que a UI seja atualizada
        await Promise.all([
          fetchAllUsers(),
          fetchSystemStats(),
          fetchAllReservations()
        ]);
      } else {
        console.error('No data returned from update');
        toast({
          title: "Erro ao alterar permissão",
          description: "Nenhum usuário foi atualizado. Verifique se o usuário existe.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Exception in toggleUserAdmin:', error);
      toast({
        title: "Erro ao alterar permissão",
        description: "Erro interno. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const toggleLaboratoryStatus = async (laboratoryId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('laboratory_settings')
        .update({ is_active: !currentStatus })
        .eq('id', laboratoryId);

      if (error) {
        toast({
          title: "Erro ao alterar status",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Status alterado!",
        description: `Laboratório ${!currentStatus ? 'ativado' : 'inativado'} com sucesso.`
      });

      fetchLaboratorySettings();
    } catch (error) {
      console.error('Error toggling laboratory status:', error);
      toast({
        title: "Erro ao alterar status",
        description: "Erro interno. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const updateLaboratoryName = async (laboratoryId: string) => {
    if (!laboratoryEditForm.laboratory_name.trim()) {
      toast({
        title: "Nome inválido",
        description: "O nome do laboratório não pode estar vazio.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('laboratory_settings')
        .update({ laboratory_name: laboratoryEditForm.laboratory_name.trim() })
        .eq('id', laboratoryId);

      if (error) {
        toast({
          title: "Erro ao atualizar nome",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Nome atualizado!",
        description: "O nome do laboratório foi alterado com sucesso."
      });

      setEditingLaboratory(null);
      setLaboratoryEditForm({ laboratory_name: '' });
      fetchLaboratorySettings();
    } catch (error) {
      console.error('Error updating laboratory name:', error);
      toast({
        title: "Erro ao atualizar nome",
        description: "Erro interno. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const createNewLaboratory = async () => {
    if (!newLaboratoryForm.laboratory_name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Nome do laboratório é obrigatório.",
        variant: "destructive"
      });
      return;
    }

    // Gerar um código único baseado no nome
    const generateLabCode = (name: string) => {
      const normalized = name.toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9]/g, '_');
      return `laboratory_${normalized}`;
    };

    const laboratoryCode = generateLabCode(newLaboratoryForm.laboratory_name.trim());

    try {
      const { error } = await supabase
        .from('laboratory_settings')
        .insert({
          laboratory_code: laboratoryCode,
          laboratory_name: newLaboratoryForm.laboratory_name.trim(),
          is_active: true
        });

      if (error) {
        toast({
          title: "Erro ao criar laboratório",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Laboratório criado!",
        description: "Novo laboratório adicionado com sucesso."
      });

      setAddingLaboratory(false);
      setNewLaboratoryForm({ laboratory_code: '', laboratory_name: '' });
      fetchLaboratorySettings();
    } catch (error) {
      console.error('Error creating laboratory:', error);
      toast({
        title: "Erro ao criar laboratório",
        description: "Erro interno. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const exportReservations = () => {
    if (reservations.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há reservas para exportar.",
        variant: "destructive"
      });
      return;
    }

    const csvContent = [
      ['Nome', 'Usuário Institucional', 'Equipamento', 'Data', 'Dia da Semana', 'Criado em'].join(','),
      ...reservations.map(reservation => {
        const reservationDate = new Date(reservation.reservation_date + 'T12:00:00');
        const dayOfWeek = format(reservationDate, 'EEEE', { locale: ptBR });
        const formattedDate = format(reservationDate, "dd/MM/yyyy");
        const createdAt = format(new Date(reservation.created_at), "dd/MM/yyyy HH:mm");
        
        return [
          `"${reservation.profiles.display_name}"`,
          `"${reservation.profiles.institutional_user}"`,
          `"${getEquipmentLabel(reservation.equipment_type)}"`,
          `"${formattedDate}"`,
          `"${dayOfWeek}"`,
          `"${createdAt}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reservas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast({
      title: "Relatório exportado!",
      description: "O arquivo CSV foi baixado com sucesso."
    });
  };

  const changeUserPin = async (userId: string) => {
    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      toast({
        title: "PIN inválido",
        description: "O PIN deve conter exatamente 6 dígitos numéricos.",
        variant: "destructive"
      });
      return;
    }

    if (newPin !== confirmPin) {
      toast({
        title: "PINs não coincidem",
        description: "A confirmação do PIN não confere.",
        variant: "destructive"
      });
      return;
    }

    try {
      const bcrypt = await import('bcryptjs');
      const pinHash = await bcrypt.hash(newPin, 10);

      const { error } = await supabase
        .from('profiles')
        .update({ pin_hash: pinHash })
        .eq('user_id', userId);

      if (error) {
        toast({
          title: "Erro ao alterar PIN",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "PIN alterado com sucesso!",
          description: "O PIN do usuário foi atualizado."
        });
        setChangingPin(null);
        setNewPin('');
        setConfirmPin('');
      }
    } catch (error) {
      toast({
        title: "Erro ao alterar PIN",
        description: "Erro interno. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    try {
      console.log('🗑️ Starting detailed user deletion for:', { userId, userName });
      console.log('🔐 Current user permissions check...');
      
      // First verify current user is admin and has permission
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('is_admin, institutional_user')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();
      
      console.log('👤 Current user admin status:', currentUserProfile);
      
      // Verificar se o usuário existe antes da exclusão
      const { data: userBeforeDelete, error: userCheckError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (userCheckError || !userBeforeDelete) {
        console.error('❌ User not found before deletion:', userCheckError);
        toast({
          title: "Usuário não encontrado",
          description: "O usuário não existe ou já foi excluído.",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ User found before deletion:', userBeforeDelete);

      // Step 1: Delete all user reservations
      console.log('🗑️ Step 1: Deleting user reservations...');
      const { data: deletedReservations, error: reservationsError } = await supabase
        .from('reservations')
        .delete()
        .eq('user_id', userId)
        .select(); // Return deleted rows for confirmation

      if (reservationsError) {
        console.error('❌ Error deleting reservations:', reservationsError);
        toast({
          title: "Erro ao excluir reservas",
          description: reservationsError.message,
          variant: "destructive"
        });
        return;
      }

      console.log(`✅ Deleted ${deletedReservations?.length || 0} reservations:`, deletedReservations);

      // Step 2: Delete the user profile
      console.log('🗑️ Step 2: Deleting user profile...');
      const { data: deletedProfile, error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId)
        .select(); // Return deleted rows for confirmation

      if (profileError) {
        console.error('❌ Error deleting profile:', profileError);
        toast({
          title: "Erro ao excluir perfil",
          description: `Erro detalhado: ${profileError.message}. Code: ${profileError.code}`,
          variant: "destructive"
        });
        return;
      }

      if (!deletedProfile || deletedProfile.length === 0) {
        console.error('❌ No profile was deleted. This might indicate RLS policy issues.');
        toast({
          title: "Erro na exclusão",
          description: "Nenhum perfil foi excluído. Pode ser um problema de permissões.",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Successfully deleted profile:', deletedProfile[0]);

      // Step 3: Delete from auth system using direct call to edge function
      console.log('🗑️ Step 3: Deleting from auth system...');
      
      let authDeleted = false;
      
      // Try direct HTTP call to edge function
      try {
        console.log('🔄 Calling edge function directly...');
        const response = await fetch(`https://frkqhvdsrjuxgcfjbtsp.supabase.co/functions/v1/admin-auth-manager`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZya3FodmRzcmp1eGdjZmpidHNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4Mjg2NjUsImV4cCI6MjA2OTQwNDY2NX0.SlEZUyfyvPWfFT3fLIT_BljVtHkD1W0TYtvsJn17aR8`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            userId: userId,
            operation: 'delete'
          })
        });

        const result = await response.json();
        console.log('🔐 Edge function response:', { 
          status: response.status, 
          ok: response.ok,
          result 
        });

        if (response.ok && result.success) {
          authDeleted = true;
          console.log('✅ Auth user deleted successfully via edge function');
        } else {
          console.warn('⚠️ Edge function failed:', result);
        }
      } catch (edgeError) {
        console.warn('⚠️ Edge function error:', edgeError);
      }

      // If edge function failed, try direct admin API
      if (!authDeleted) {
        try {
          console.log('🔄 Trying direct admin API as fallback...');
          const { data: directResult, error: directError } = await supabase.auth.admin.deleteUser(userId);
          
          console.log('🔐 Direct admin API result:', { directResult, directError });
          
          if (!directError) {
            authDeleted = true;
            console.log('✅ Auth user deleted via direct admin API');
          } else {
            console.warn('⚠️ Direct admin API failed:', directError.message);
          }
        } catch (directException) {
          console.warn('⚠️ Direct admin API exception:', directException);
        }
      }

      // Step 4: Verify deletion
      console.log('🔍 Step 4: Verifying deletion...');
      const { data: verifyProfile, error: verifyError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (verifyProfile) {
        console.error('❌ Profile still exists after deletion!', verifyProfile);
        toast({
          title: "Erro na verificação",
          description: "O perfil ainda existe após a tentativa de exclusão.",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Deletion verified - profile no longer exists');

      toast({
        title: "Usuário excluído com sucesso!",
        description: `${userName} foi removido completamente do sistema.`
      });
      
      console.log('🎉 User deletion process completed successfully');
      
      // Reload all data to refresh the UI
      await Promise.all([
        fetchAllUsers(),
        fetchSystemStats(),
        fetchAllReservations()
      ]);
      
    } catch (exception) {
      console.error('❌ Exception in deleteUser:', exception);
      toast({
        title: "Erro crítico na exclusão",
        description: `Erro interno: ${exception.message}`,
        variant: "destructive"
      });
    }
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
    try {
      console.log('Admin attempting to cancel reservation:', reservationId);
      
      const { data, error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId)
        .select(); // Retornar dados para confirmar a deleção

      console.log('Admin delete result:', { data, error });

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
        console.log('Reservation successfully deleted by admin:', data[0]);
        toast({
          title: "Reserva cancelada",
          description: "A reserva foi cancelada com sucesso."
        });
        
        // Forçar atualização imediata de todos os dados
        await Promise.all([
          fetchAllReservations(),
          fetchSystemStats()
        ]);
        
        // Pequeno delay e segunda atualização para garantir sincronização
        setTimeout(async () => {
          await Promise.all([
            fetchAllReservations(),
            fetchSystemStats()
          ]);
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
      console.error('Exception in admin cancelReservation:', error);
      toast({
        title: "Erro ao cancelar reserva",
        description: "Erro interno. Tente novamente.",
        variant: "destructive"
      });
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
        return <Projector className="h-4 w-4" />;
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
                  <Projector className="h-4 w-4" />
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
                  const reservationDate = new Date(reservation.reservation_date + 'T12:00:00');
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

      {/* System Statistics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Estatísticas do Sistema
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportReservations}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Relatório
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Total de Usuários</span>
              </div>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Total de Reservas</span>
              </div>
              <div className="text-2xl font-bold">{stats?.totalReservations || 0}</div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Administradores</span>
              </div>
              <div className="text-2xl font-bold">{stats?.totalAdmins || 0}</div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Reservas esta Semana</span>
              </div>
              <div className="text-2xl font-bold">{stats?.reservationsThisWeek || 0}</div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Projector className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Projetores Reservados</span>
              </div>
              <div className="text-2xl font-bold">{stats?.projectorReservations || 0}</div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Speaker className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Caixas de Som Reservadas</span>
              </div>
              <div className="text-2xl font-bold">{stats?.speakerReservations || 0}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Gestão de Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhum usuário encontrado
              </h3>
              <p className="text-sm text-muted-foreground">
                Ainda não há usuários cadastrados no sistema.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Usuário Institucional</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.display_name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {user.institutional_user}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.is_admin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}>
                        <div className="flex items-center gap-1">
                          {user.is_admin ? (
                            <>
                              <Shield className="h-3 w-3" />
                              Administrador
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3" />
                              Usuário
                            </>
                          )}
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {/* Change PIN Dialog */}
                        <Dialog open={changingPin === user.user_id} onOpenChange={(open) => {
                          if (!open) {
                            setChangingPin(null);
                            setNewPin('');
                            setConfirmPin('');
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-blue-600 hover:text-blue-600"
                              onClick={() => setChangingPin(user.user_id)}
                            >
                              <Key className="h-3 w-3 mr-2" />
                              Alterar PIN
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Alterar PIN do Usuário</DialogTitle>
                              <DialogDescription>
                                Definir novo PIN para {user.display_name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <Label htmlFor="new-pin">Novo PIN (6 dígitos)</Label>
                                <Input
                                  id="new-pin"
                                  type="password"
                                  placeholder="123456"
                                  maxLength={6}
                                  value={newPin}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '');
                                    setNewPin(value);
                                  }}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="confirm-pin">Confirmar PIN</Label>
                                <Input
                                  id="confirm-pin"
                                  type="password"
                                  placeholder="123456"
                                  maxLength={6}
                                  value={confirmPin}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '');
                                    setConfirmPin(value);
                                  }}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => {
                                setChangingPin(null);
                                setNewPin('');
                                setConfirmPin('');
                              }}>
                                Cancelar
                              </Button>
                              <Button onClick={() => changeUserPin(user.user_id)}>
                                Alterar PIN
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {/* Toggle Admin */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className={user.is_admin ? 'text-orange-600 hover:text-orange-600' : 'text-purple-600 hover:text-purple-600'}
                            >
                              {user.is_admin ? (
                                <>
                                  <ShieldOff className="h-3 w-3 mr-2" />
                                  Remover Admin
                                </>
                              ) : (
                                <>
                                  <Shield className="h-3 w-3 mr-2" />
                                  Tornar Admin
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {user.is_admin ? 'Remover' : 'Conceder'} Privilégios de Administrador
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja {user.is_admin ? 'remover os privilégios de administrador de' : 'tornar'} {user.display_name} {user.is_admin ? '' : 'um administrador'}? 
                                {user.is_admin ? ' Ele perderá acesso às funções administrativas.' : ' Ele terá acesso completo ao painel administrativo.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => toggleUserAdmin(user.user_id, user.is_admin)}
                                className={user.is_admin ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700'}
                              >
                                {user.is_admin ? 'Remover Privilégios' : 'Conceder Privilégios'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* Delete User */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-red-600 hover:text-red-600"
                            >
                              <UserMinus className="h-3 w-3 mr-2" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir permanentemente o usuário {user.display_name}? 
                                Esta ação irá:
                                <br />• Excluir todas as reservas do usuário
                                <br />• Remover o cadastro completamente
                                <br />• Esta ação não pode ser desfeita
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteUser(user.user_id, user.display_name)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                Excluir Permanentemente
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Laboratory Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5" />
                Gestão de Laboratórios
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Ativar, inativar, renomear laboratórios ou adicionar novos
              </p>
            </div>
            <Dialog open={addingLaboratory} onOpenChange={setAddingLaboratory}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Laboratório
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Laboratório</DialogTitle>
                  <DialogDescription>
                    Crie um novo laboratório para o sistema de reservas
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="lab-code">Código do Laboratório</Label>
                    <Input
                      id="lab-code"
                      placeholder="Ex: laboratory_201_lab_fisica"
                      value={newLaboratoryForm.laboratory_code}
                      onChange={(e) => setNewLaboratoryForm(prev => ({ ...prev, laboratory_code: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use formato: laboratory_numero_descricao (sem espaços, use _ para separar)
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lab-name">Nome do Laboratório</Label>
                    <Input
                      id="lab-name"
                      placeholder="Ex: 201 - LAB FÍSICA"
                      value={newLaboratoryForm.laboratory_name}
                      onChange={(e) => setNewLaboratoryForm(prev => ({ ...prev, laboratory_name: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setAddingLaboratory(false);
                    setNewLaboratoryForm({ laboratory_code: '', laboratory_name: '' });
                  }}>
                    Cancelar
                  </Button>
                  <Button onClick={createNewLaboratory}>
                    Criar Laboratório
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {laboratorySettings.length === 0 ? (
            <div className="text-center py-8">
              <FlaskConical className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                Nenhum laboratório encontrado
              </h3>
              <p className="text-sm text-muted-foreground">
                Carregando configurações dos laboratórios...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {laboratorySettings.map((lab) => (
                <Card key={lab.id} className={`transition-all duration-200 ${lab.is_active ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {editingLaboratory === lab.id ? (
                          <div className="space-y-2">
                            <Input
                              value={laboratoryEditForm.laboratory_name}
                              onChange={(e) => setLaboratoryEditForm({ laboratory_name: e.target.value })}
                              className="text-sm"
                              autoFocus
                            />
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => updateLaboratoryName(lab.id)}
                                className="h-6 px-2 text-xs"
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingLaboratory(null);
                                  setLaboratoryEditForm({ laboratory_name: '' });
                                }}
                                className="h-6 px-2 text-xs"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-sm truncate">{lab.laboratory_name}</h3>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingLaboratory(lab.id);
                                  setLaboratoryEditForm({ laboratory_name: lab.laboratory_name });
                                }}
                                className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                                title="Editar nome"
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 truncate">
                              {lab.laboratory_code}
                            </p>
                          </>
                        )}
                        
                        {editingLaboratory !== lab.id && (
                          <Badge variant={lab.is_active ? "default" : "secondary"} className="text-xs">
                            {lab.is_active ? (
                              <>
                                <Power className="h-3 w-3 mr-1" />
                                Ativo
                              </>
                            ) : (
                              <>
                                <PowerOff className="h-3 w-3 mr-1" />
                                Inativo
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                      
                      {editingLaboratory !== lab.id && (
                        <div className="flex flex-col gap-1 ml-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant={lab.is_active ? "destructive" : "default"}
                                className="h-6 px-2 text-xs"
                              >
                                {lab.is_active ? (
                                  <>
                                    <PowerOff className="h-3 w-3 mr-1" />
                                    Inativar
                                  </>
                                ) : (
                                  <>
                                    <Power className="h-3 w-3 mr-1" />
                                    Ativar
                                  </>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {lab.is_active ? 'Inativar' : 'Ativar'} Laboratório
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja {lab.is_active ? 'inativar' : 'ativar'} o laboratório {lab.laboratory_name}?
                                  {lab.is_active && (
                                    <span className="block mt-2 text-yellow-600">
                                      ⚠️ Ao inativar, novos agendamentos não poderão ser feitos para este laboratório.
                                    </span>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => toggleLaboratoryStatus(lab.id, lab.is_active)}
                                  className={lab.is_active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                                >
                                  {lab.is_active ? 'Sim, inativar' : 'Sim, ativar'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}