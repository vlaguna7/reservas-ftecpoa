import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Settings, Users, Calendar as CalendarIcon, Projector, Speaker, MonitorSpeaker, Trash2, Edit3, Save, X, BarChart3, Download, Activity, UserCheck, UserX, Shield, ShieldOff, Key, UserMinus, FlaskConical, Power, PowerOff, Plus, HelpCircle, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { SecureLogger } from '@/lib/secureLogger';
import { InputSanitizer } from '@/lib/inputSanitizer';
import { EmailManagement } from './EmailManagement';
import { ErrorBoundary } from './ErrorBoundary';

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
  green_tag_text?: string | null;
  created_at: string;
  classroom_monday?: string;
  classroom_tuesday?: string;
  classroom_wednesday?: string;
  classroom_thursday?: string;
  classroom_friday?: string;
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

interface FAQ {
  id: string;
  question: string;
  answer: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface NotificationEmail {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  notify_projector?: boolean;
  notify_speaker?: boolean;
  notify_laboratory?: boolean;
  notify_auditorium?: boolean;
}

interface AdminAlert {
  id: string;
  title: string;
  message: string;
  duration: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

interface AuditoriumReservation {
  id: string;
  reservation_date: string;
  observation: string;
  created_at: string;
  time_slots?: string[];
  user_profile: {
    display_name: string;
  };
}

interface LaboratoryReservation {
  id: string;
  reservation_date: string;
  observation: string;
  equipment_type: string;
  user_profile: {
    display_name: string;
  };
}

export function AdminPanel() {
  const isMobile = useIsMobile();
  const [equipmentSettings, setEquipmentSettings] = useState<EquipmentSettings | null>(null);
  const [reservations, setReservations] = useState<ReservationWithProfile[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [laboratorySettings, setLaboratorySettings] = useState<LaboratorySetting[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [editingReservation, setEditingReservation] = useState<string | null>(null);
  const [editingLaboratory, setEditingLaboratory] = useState<string | null>(null);
  const [addingLaboratory, setAddingLaboratory] = useState(false);
  const [changingPin, setChangingPin] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [greenTagDialogOpen, setGreenTagDialogOpen] = useState(false);
  const [greenTagText, setGreenTagText] = useState("");
  
  // Classroom management states
  const [editingClassrooms, setEditingClassrooms] = useState<string | null>(null);
  const [classroomDialogOpen, setClassroomDialogOpen] = useState(false);
  const [classroomData, setClassroomData] = useState({
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: ""
  });
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
  
  // Estados para FAQs
  const [editingFaq, setEditingFaq] = useState<string | null>(null);
  const [addingFaq, setAddingFaq] = useState(false);
  const [faqEditForm, setFaqEditForm] = useState({
    question: '',
    answer: '',
    is_active: true,
    sort_order: 0
  });
  const [newFaqForm, setNewFaqForm] = useState({
    question: '',
    answer: '',
    sort_order: 0
  });
  
  // Estados para emails de notificação
  const [notificationEmails, setNotificationEmails] = useState<NotificationEmail[]>([]);
  const [addingEmail, setAddingEmail] = useState(false);
  const [newEmailForm, setNewEmailForm] = useState({
    email: ''
  });
  
  // Estados para alertas admin
  const [adminAlerts, setAdminAlerts] = useState<AdminAlert[]>([]);
  const [addingAlert, setAddingAlert] = useState(false);
  const [editingAlert, setEditingAlert] = useState<string | null>(null);
  const [newAlertForm, setNewAlertForm] = useState({
    title: '',
    message: '',
    duration: 5 as string | number,
    expires_at: null as Date | null
  });
  const [tempEditMinutes, setTempEditMinutes] = useState<string>('');
  const [tempMinutes, setTempMinutes] = useState<string>('');
  const [alertEditForm, setAlertEditForm] = useState({
    title: '',
    message: '',
    duration: 5 as string | number,
    is_active: true,
    expires_at: null as Date | null
  });
  
  const [auditoriumReservations, setAuditoriumReservations] = useState<AuditoriumReservation[]>([]);
  const [laboratoryReservations, setLaboratoryReservations] = useState<LaboratoryReservation[]>([]);
  const [selectedAuditoriumDate, setSelectedAuditoriumDate] = useState<Date | undefined>(undefined);
  const [selectedLabDate, setSelectedLabDate] = useState<Date | undefined>(undefined);
  const [showAuditoriumDetails, setShowAuditoriumDetails] = useState(false);
  const [showLabDetails, setShowLabDetails] = useState(false);

  // Sync temp minutes with actual dates
  useEffect(() => {
    if (newAlertForm.expires_at) {
      setTempMinutes(newAlertForm.expires_at.getMinutes().toString());
    } else {
      setTempMinutes('');
    }
  }, [newAlertForm.expires_at]);

  useEffect(() => {
    if (alertEditForm.expires_at) {
      setTempEditMinutes(alertEditForm.expires_at.getMinutes().toString());
    } else {
      setTempEditMinutes('');
    }
  }, [alertEditForm.expires_at]);

  useEffect(() => {
    fetchEquipmentSettings();
    fetchAllReservations();
    fetchAllUsers();
    fetchLaboratorySettings();
    fetchFaqs();
    fetchNotificationEmails();
    fetchAdminAlerts();
    fetchSystemStats();
    fetchAuditoriumReservations();
    fetchLaboratoryReservations();

    // Configurar realtime updates para reservations
    const channel = supabase
      .channel('admin-reservations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations'
        },
        (payload) => {
          // Real-time change detected
          // Aguardar um pouco para garantir que a operação foi concluída
          setTimeout(() => {
            fetchAuditoriumReservations();
            fetchLaboratoryReservations();
            fetchAllReservations();
          }, 100);
        }
      )
      .subscribe();

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

  const handleGreenTagClick = (user: UserProfile) => {
    setSelectedUser(user);
    setGreenTagText(user.green_tag_text || "");
    setGreenTagDialogOpen(true);
  };

  const saveGreenTagText = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ green_tag_text: greenTagText.trim() || null })
        .eq('id', selectedUser.id);

      if (error) throw error;

      // Update local state
      setUsers(users.map(user => 
        user.id === selectedUser.id 
          ? { ...user, green_tag_text: greenTagText.trim() || null }
          : user
      ));

      toast({
        title: "Sucesso",
        description: "Texto da tag atualizado com sucesso",
      });

      setGreenTagDialogOpen(false);
    } catch (error) {
      console.error('Error updating green tag text:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao atualizar o texto da tag",
      });
    }
  };

  const handleClassroomClick = (user: UserProfile) => {
    setEditingClassrooms(user.user_id);
    setClassroomData({
      monday: user.classroom_monday || "",
      tuesday: user.classroom_tuesday || "",
      wednesday: user.classroom_wednesday || "",
      thursday: user.classroom_thursday || "",
      friday: user.classroom_friday || ""
    });
    setClassroomDialogOpen(true);
  };

  const handleClassroomSave = async () => {
    if (!editingClassrooms) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          classroom_monday: classroomData.monday || null,
          classroom_tuesday: classroomData.tuesday || null,
          classroom_wednesday: classroomData.wednesday || null,
          classroom_thursday: classroomData.thursday || null,
          classroom_friday: classroomData.friday || null
        })
        .eq('user_id', editingClassrooms);

      if (error) throw error;
      
      toast({
        title: "Salas atualizadas",
        description: "As salas foram atualizadas com sucesso.",
      });
      
      setClassroomDialogOpen(false);
      setEditingClassrooms(null);
      setClassroomData({
        monday: "",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: ""
      });
      fetchAllUsers();
    } catch (error) {
      console.error('Error updating classrooms:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar as salas.",
        variant: "destructive",
      });
    }
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

  const fetchFaqs = async () => {
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching FAQs:', error);
      return;
    }

    setFaqs(data || []);
  };

  const fetchNotificationEmails = async () => {
    const { data, error } = await supabase
      .from('admin_notification_emails')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching notification emails:', error);
      return;
    }

    setNotificationEmails(data || []);
  };

  const fetchAdminAlerts = async () => {
    const { data, error } = await supabase
      .from('admin_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin alerts:', error);
      return;
    }

    setAdminAlerts(data || []);
  };

  const createAlert = async () => {
    if (!newAlertForm.title.trim() || !newAlertForm.message.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o título e a mensagem.",
        variant: "destructive"
      });
      return;
    }

    const durationNum = typeof newAlertForm.duration === 'string' ? parseInt(newAlertForm.duration) || 5 : newAlertForm.duration;
    if (durationNum < 1) {
      toast({
        title: "Duração inválida",
        description: "A duração deve ser pelo menos 1 segundo.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_alerts')
        .insert({
          title: newAlertForm.title.trim(),
          message: newAlertForm.message.trim(),
          duration: durationNum,
          expires_at: newAlertForm.expires_at?.toISOString()
        });

      if (error) throw error;

      toast({
        title: "Alerta criado!",
        description: "O alerta foi criado com sucesso."
      });

      setAddingAlert(false);
      setNewAlertForm({ title: '', message: '', duration: 5, expires_at: null });
      fetchAdminAlerts();
    } catch (error) {
      console.error('Error creating alert:', error);
      toast({
        title: "Erro ao criar alerta",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const updateAlert = async (alertId: string) => {
    if (!alertEditForm.title.trim() || !alertEditForm.message.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha o título e a mensagem.",
        variant: "destructive"
      });
      return;
    }

    const durationNum = typeof alertEditForm.duration === 'string' ? parseInt(alertEditForm.duration) || 5 : alertEditForm.duration;

    try {
      const { error } = await supabase
        .from('admin_alerts')
        .update({
          title: alertEditForm.title.trim(),
          message: alertEditForm.message.trim(),
          duration: durationNum,
          is_active: alertEditForm.is_active,
          expires_at: alertEditForm.expires_at?.toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "Alerta atualizado!",
        description: "As alterações foram salvas."
      });

      setEditingAlert(null);
      fetchAdminAlerts();
    } catch (error) {
      console.error('Error updating alert:', error);
      toast({
        title: "Erro ao atualizar alerta",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const deleteAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('admin_alerts')
        .delete()
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: "Alerta excluído!",
        description: "O alerta foi removido."
      });

      fetchAdminAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
      toast({
        title: "Erro ao excluir alerta",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const toggleAlertStatus = async (alertId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('admin_alerts')
        .update({ is_active: !currentStatus })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: `Alerta ${!currentStatus ? 'ativado' : 'desativado'}!`,
        description: `O alerta foi ${!currentStatus ? 'ativado' : 'desativado'}.`
      });

      fetchAdminAlerts();
    } catch (error) {
      console.error('Error toggling alert status:', error);
      toast({
        title: "Erro ao alterar status",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const createNotificationEmail = async () => {
    if (!newEmailForm.email.trim()) {
      toast({
        title: "Email é obrigatório",
        description: "Por favor, insira um endereço de email válido.",
        variant: "destructive"
      });
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmailForm.email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, insira um endereço de email válido.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('admin_notification_emails')
        .insert({
          email: newEmailForm.email.trim()
        });

      if (error) {
        if (error.code === '23505') { // unique violation
          toast({
            title: "Email já cadastrado",
            description: "Este email já está na lista de notificações.",
            variant: "destructive"
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Email adicionado!",
        description: "O email foi adicionado à lista de notificações."
      });

      setAddingEmail(false);
      setNewEmailForm({ email: '' });
      fetchNotificationEmails();
    } catch (error) {
      console.error('Error creating notification email:', error);
      toast({
        title: "Erro ao adicionar email",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const deleteNotificationEmail = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from('admin_notification_emails')
        .delete()
        .eq('id', emailId);

      if (error) throw error;

      toast({
        title: "Email removido!",
        description: "O email foi removido da lista de notificações."
      });

      fetchNotificationEmails();
    } catch (error) {
      console.error('Error deleting notification email:', error);
      toast({
        title: "Erro ao remover email",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const toggleNotificationEmailStatus = async (emailId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('admin_notification_emails')
        .update({ is_active: !currentStatus })
        .eq('id', emailId);

      if (error) throw error;

      toast({
        title: `Email ${!currentStatus ? 'ativado' : 'desativado'}!`,
        description: `O email foi ${!currentStatus ? 'ativado' : 'desativado'} para notificações.`
      });

      fetchNotificationEmails();
    } catch (error) {
      console.error('Error toggling email status:', error);
      toast({
        title: "Erro ao alterar status",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const updateNotificationPreferences = async (emailId: string, field: string, value: boolean) => {
    try {
      const { error } = await supabase
        .from('admin_notification_emails')
        .update({ [field]: value })
        .eq('id', emailId);

      if (error) throw error;

      toast({
        title: "Preferências atualizadas!",
        description: "As configurações de notificação foram salvas."
      });

      fetchNotificationEmails();
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      toast({
        title: "Erro ao atualizar preferências",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
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
      SecureLogger.log('Updating admin status for user');
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentAdminStatus })
        .eq('user_id', userId)
        .select();

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

  const deleteLaboratory = async (laboratoryId: string, laboratoryCode: string) => {
    try {
      // Primeiro, remover todas as reservas futuras deste laboratório
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      const { error: reservationsError } = await supabase
        .from('reservations')
        .delete()
        .eq('equipment_type', laboratoryCode)
        .gte('reservation_date', todayStr);

      if (reservationsError) {
        toast({
          title: "Erro ao remover reservas",
          description: reservationsError.message,
          variant: "destructive"
        });
        return;
      }

      // Agora, excluir o laboratório
      const { error } = await supabase
        .from('laboratory_settings')
        .delete()
        .eq('id', laboratoryId);

      if (error) {
        toast({
          title: "Erro ao excluir laboratório",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Laboratório excluído!",
        description: "O laboratório e suas reservas futuras foram removidos com sucesso."
      });

      await fetchLaboratorySettings();
    } catch (error) {
      console.error('Exception in deleteLaboratory:', error);
      toast({
        title: "Erro ao excluir laboratório",
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
    // Validate PIN using secure input sanitizer
    if (!InputSanitizer.validatePin(newPin)) {
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

    // Rate limiting for PIN changes
    const rateLimitKey = `pin-change-${userId}`;
    if (!InputSanitizer.checkRateLimit(rateLimitKey, 3, 300000)) { // 3 attempts per 5 minutes
      toast({
        title: "Limite excedido",
        description: "Muitas tentativas de alteração de PIN. Tente novamente em 5 minutos.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Hash do PIN
      const bcrypt = await import('bcryptjs');
      const pinHash = await bcrypt.hash(newPin, 10);

      // Atualizar o pin_hash na tabela profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ pin_hash: pinHash })
        .eq('user_id', userId);

      if (profileError) {
        toast({
          title: "Erro ao alterar PIN",
          description: profileError.message,
          variant: "destructive"
        });
        return;
      }

      // Atualizar a senha do usuário no auth usando a edge function
      const { error: authError } = await supabase.functions.invoke('update-user-password', {
        body: {
          userId: userId,
          newPassword: newPin
        }
      });

      if (authError) {
        toast({
          title: "Erro ao alterar PIN de autenticação",
          description: authError.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "PIN alterado com sucesso!",
        description: "O PIN do usuário foi atualizado."
      });
      setChangingPin(null);
      setNewPin('');
      setConfirmPin('');
      fetchAllUsers();
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
      SecureLogger.log('Admin attempting to cancel reservation');
      
      const { data, error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', reservationId)
        .select();

      if (error) {
        SecureLogger.error('Error canceling reservation', error);
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

  const fetchAuditoriumReservations = async () => {
    try {
      // Buscar todas as reservas do auditório a partir de hoje
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const { data: reservationData, error: reservationError } = await supabase
        .from('reservations')
        .select('id, reservation_date, observation, user_id, created_at, time_slots')
        .eq('equipment_type', 'auditorium')
        .gte('reservation_date', todayStr)
        .order('reservation_date', { ascending: true });

      if (reservationError) {
        console.error('Error fetching auditorium reservations:', reservationError);
        return;
      }

      if (!reservationData || reservationData.length === 0) {
        setAuditoriumReservations([]);
        return;
      }

      // Buscar perfis dos usuários
      const userIds = reservationData.map(r => r.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return;
      }

      // Combinar dados
      const profileMap = new Map(profileData?.map(p => [p.user_id, p]) || []);
      const combinedData = reservationData.map(reservation => ({
        id: reservation.id,
        reservation_date: reservation.reservation_date,
        observation: reservation.observation || '',
        created_at: reservation.created_at,
        time_slots: reservation.time_slots || [],
        user_profile: {
          display_name: profileMap.get(reservation.user_id)?.display_name || 'Professor não identificado'
        }
      }));

      setAuditoriumReservations(combinedData);
    } catch (error) {
      console.error('Error fetching auditorium reservations:', error);
    }
  };

  const fetchLaboratoryReservations = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        reservation_date,
        observation,
        equipment_type,
        user_id
      `)
      .like('equipment_type', 'laboratory_%')
      .order('reservation_date', { ascending: true });

    if (error) {
      console.error('Error fetching laboratory reservations:', error);
      return;
    }

    const reservationsWithProfiles = await Promise.all(
      (data || []).map(async (reservation) => {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', reservation.user_id)
          .single();

        return {
          ...reservation,
          user_profile: profileData || { display_name: 'N/A' }
        };
      })
    );

    setLaboratoryReservations(reservationsWithProfiles);
  };

  const getAuditoriumReservationForDate = (date: Date) => {
    return auditoriumReservations.find(reservation => {
      const reservationDate = new Date(reservation.reservation_date + 'T12:00:00');
      return isSameDay(reservationDate, date);
    });
  };

  // Funções para gerenciar FAQs
  const createFaq = async () => {
    if (!newFaqForm.question.trim() || !newFaqForm.answer.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Pergunta e resposta são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('faqs')
        .insert({
          question: newFaqForm.question.trim(),
          answer: newFaqForm.answer.trim(),
          sort_order: newFaqForm.sort_order || faqs.length + 1
        });

      if (error) throw error;

      toast({
        title: "FAQ criada!",
        description: "A pergunta frequente foi adicionada com sucesso."
      });

      setAddingFaq(false);
      setNewFaqForm({
        question: '',
        answer: '',
        sort_order: 0
      });
      fetchFaqs();
    } catch (error) {
      console.error('Error creating FAQ:', error);
      toast({
        title: "Erro ao criar FAQ",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const updateFaq = async (faqId: string) => {
    if (!faqEditForm.question.trim() || !faqEditForm.answer.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Pergunta e resposta são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('faqs')
        .update({
          question: faqEditForm.question.trim(),
          answer: faqEditForm.answer.trim(),
          is_active: faqEditForm.is_active,
          sort_order: faqEditForm.sort_order
        })
        .eq('id', faqId);

      if (error) throw error;

      toast({
        title: "FAQ atualizada!",
        description: "As alterações foram salvas."
      });

      setEditingFaq(null);
      fetchFaqs();
    } catch (error) {
      console.error('Error updating FAQ:', error);
      toast({
        title: "Erro ao atualizar FAQ",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const deleteFaq = async (faqId: string) => {
    try {
      const { error } = await supabase
        .from('faqs')
        .delete()
        .eq('id', faqId);

      if (error) throw error;

      toast({
        title: "FAQ excluída!",
        description: "A pergunta frequente foi removida."
      });

      fetchFaqs();
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      toast({
        title: "Erro ao excluir FAQ",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const toggleFaqStatus = async (faqId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('faqs')
        .update({ is_active: !currentStatus })
        .eq('id', faqId);

      if (error) throw error;

      toast({
        title: `FAQ ${!currentStatus ? 'ativada' : 'desativada'}!`,
        description: `A pergunta frequente foi ${!currentStatus ? 'ativada' : 'desativada'}.`
      });

      fetchFaqs();
    } catch (error) {
      console.error('Error toggling FAQ status:', error);
      toast({
        title: "Erro ao alterar status",
        description: "Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const getLaboratoryReservationsForDate = (date: Date) => {
    return laboratoryReservations.filter(reservation => {
      const reservationDate = new Date(reservation.reservation_date + 'T12:00:00');
      return isSameDay(reservationDate, date);
    });
  };

  const handleAuditoriumDateSelect = (date: Date | undefined) => {
    if (date) {
      // Sempre permitir seleção da data, mesmo se não houver reservas
      setSelectedAuditoriumDate(date);
      setShowAuditoriumDetails(true);
    } else {
      setSelectedAuditoriumDate(undefined);
      setShowAuditoriumDetails(false);
    }
  };

  const handleLabDateSelect = (date: Date | undefined) => {
    if (date) {
      const reservations = getLaboratoryReservationsForDate(date);
      if (reservations.length > 0) {
        setSelectedLabDate(date);
        setShowLabDetails(true);
      }
    } else {
      setSelectedLabDate(undefined);
      setShowLabDetails(false);
    }
  };

  const getLabNameFromCode = (equipmentType: string) => {
    const labCode = equipmentType.replace('laboratory_', '');
    const lab = laboratorySettings.find(lab => lab.laboratory_code === `laboratory_${labCode}`);
    return lab ? lab.laboratory_name : `Laboratório ${labCode}`;
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
      <Card className="shadow-lg">
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
                  value={settingsForm.projector_limit || ''}
                  onChange={(e) => setSettingsForm(prev => ({ 
                    ...prev, 
                    projector_limit: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 
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
                  value={settingsForm.speaker_limit || ''}
                  onChange={(e) => setSettingsForm(prev => ({ 
                    ...prev, 
                    speaker_limit: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 
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

      {/* Auditorium Calendar */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendário de Auditório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedAuditoriumDate}
              onSelect={handleAuditoriumDateSelect}
              locale={ptBR}
              className="rounded-md border"
              modifiers={{
                hasReservation: (date) => {
                  return auditoriumReservations.some(reservation => {
                    const reservationDate = new Date(reservation.reservation_date + 'T12:00:00');
                    return isSameDay(reservationDate, date);
                  });
                }
              }}
              modifiersStyles={{
                hasReservation: { backgroundColor: '#22c55e', color: 'white' }
              }}
            />
            
            {showAuditoriumDetails && selectedAuditoriumDate && (
              <Dialog open={showAuditoriumDetails} onOpenChange={setShowAuditoriumDetails}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Reservas do Auditório</DialogTitle>
                    <DialogDescription>
                      {format(selectedAuditoriumDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </DialogDescription>
                  </DialogHeader>
                   {(() => {
                     const reservationsForDate = auditoriumReservations.filter(reservation => {
                       const reservationDate = new Date(reservation.reservation_date + 'T12:00:00');
                       return isSameDay(reservationDate, selectedAuditoriumDate);
                     });
                     
                     console.log('🗓️ Reservas para data selecionada:', reservationsForDate);
                     console.log('🗓️ Todas as reservas do auditório:', auditoriumReservations);
                     
                     return reservationsForDate.length > 0 ? (
                      <div className="space-y-6 max-h-96 overflow-y-auto">
                        {reservationsForDate.map((reservation, index) => (
                          <div key={reservation.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Reserva {index + 1}</h4>
                              <span className="text-xs text-muted-foreground">
                                ID: {reservation.id.slice(0, 8)}...
                              </span>
                            </div>
                            
                            <div>
                              <Label className="text-sm font-medium">Reservado por:</Label>
                              <p className="mt-1 text-sm">{reservation.user_profile.display_name}</p>
                            </div>
                            
                            {reservation.time_slots && reservation.time_slots.length > 0 && (
                              <div>
                                <Label className="text-sm font-medium">Horários:</Label>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {reservation.time_slots.map((slot) => {
                                    const timeSlotLabels = {
                                      'morning': 'Manhã - 09h/12h',
                                      'afternoon': 'Tarde - 13h/18h',
                                      'evening': 'Noite - 19h/22h'
                                    };
                                    return (
                                      <span key={slot} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                                        {timeSlotLabels[slot as keyof typeof timeSlotLabels] || slot}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            <div>
                              <Label className="text-sm font-medium">Observação:</Label>
                              <p className="mt-1 text-sm">{reservation.observation || 'Nenhuma observação'}</p>
                            </div>
                            
                            <div>
                              <Label className="text-sm font-medium">Criado em:</Label>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {format(new Date(reservation.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhuma reserva encontrada para esta data.</p>
                    );
                  })()}
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Laboratory Calendar */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Calendário de Laboratórios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Calendar
              mode="single"
              selected={selectedLabDate}
              onSelect={handleLabDateSelect}
              locale={ptBR}
              className="rounded-md border"
              modifiers={{
                hasReservation: (date) => {
                  return laboratoryReservations.some(reservation => {
                    const reservationDate = new Date(reservation.reservation_date + 'T12:00:00');
                    return isSameDay(reservationDate, date);
                  });
                }
              }}
              modifiersStyles={{
                hasReservation: { backgroundColor: '#22c55e', color: 'white' }
              }}
            />
            
            {showLabDetails && selectedLabDate && (
              <Dialog open={showLabDetails} onOpenChange={setShowLabDetails}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Reservas de Laboratórios</DialogTitle>
                    <DialogDescription>
                      {format(selectedLabDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </DialogDescription>
                  </DialogHeader>
                  {(() => {
                    const reservations = getLaboratoryReservationsForDate(selectedLabDate);
                    return reservations.length > 0 ? (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {reservations.map((reservation, index) => (
                          <div key={reservation.id} className="border rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm font-medium">Laboratório:</Label>
                                <p className="mt-1 text-sm">{getLabNameFromCode(reservation.equipment_type)}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Reservado por:</Label>
                                <p className="mt-1 text-sm">{reservation.user_profile.display_name}</p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <Label className="text-sm font-medium">Observação:</Label>
                              <p className="mt-1 text-sm">{reservation.observation || 'Nenhuma observação'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Statistics */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Estatísticas do Sistema
          </CardTitle>
           <Button variant="outline" size="sm" onClick={exportReservations} className={`${isMobile ? 'px-2' : ''}`}>
             <Download className="h-4 w-4 mr-2" />
             {isMobile ? 'Relatório' : 'Exportar Relatório'}
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
                <BarChart3 className="h-4 w-4 text-green-600" />
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
      <Card className="shadow-lg">
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
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                  <div className="flex items-center justify-center gap-2">
                    {user.green_tag_text && (
                      <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        {user.green_tag_text}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleClassroomClick(user)}
                      className="h-8 w-8 p-0"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>

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
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
               <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : ''}`}>
                 <FlaskConical className="h-5 w-5" />
                 Gestão de Laboratórios
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Ativar, inativar, renomear laboratórios ou adicionar novos
              </p>
            </div>
            <Dialog open={addingLaboratory} onOpenChange={setAddingLaboratory}>
              <DialogTrigger asChild>
                <Button className={`flex items-center ${isMobile ? 'p-2' : 'gap-2'}`}>
                  <Plus className="h-4 w-4" />
                  {!isMobile && 'Novo Laboratório'}
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
                          
                          {/* Botão de Excluir */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-6 px-2 text-xs"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Laboratório</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir permanentemente o laboratório {lab.laboratory_name}?
                                  <span className="block mt-2 text-red-600 font-medium">
                                    ⚠️ ATENÇÃO: Esta ação é irreversível e todas as reservas futuras deste laboratório serão removidas.
                                  </span>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteLaboratory(lab.id, lab.laboratory_code)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Sim, excluir permanentemente
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

      {/* FAQ Management */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Gestão de Perguntas Frequentes
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie as perguntas frequentes que aparecem na página "Fazer Reserva"
            </p>
          </div>
          <Dialog open={addingFaq} onOpenChange={setAddingFaq}>
            <DialogTrigger asChild>
              <Button className={`flex items-center ${isMobile ? 'p-2' : 'gap-2'}`}>
                <Plus className="h-4 w-4" />
                {!isMobile && 'Nova FAQ'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nova Pergunta Frequente</DialogTitle>
                <DialogDescription>
                  Adicione uma nova pergunta frequente que será exibida na página de reservas
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="new-faq-question">Pergunta *</Label>
                  <Input
                    id="new-faq-question"
                    value={newFaqForm.question}
                    onChange={(e) => setNewFaqForm(prev => ({ ...prev, question: e.target.value }))}
                    placeholder="Ex: Como fazer uma reserva?"
                  />
                </div>
                <div>
                  <Label htmlFor="new-faq-answer">Resposta *</Label>
                  <Textarea
                    id="new-faq-answer"
                    value={newFaqForm.answer}
                    onChange={(e) => setNewFaqForm(prev => ({ ...prev, answer: e.target.value }))}
                    placeholder="Digite a resposta detalhada..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="new-faq-order">Ordem de exibição</Label>
                  <Input
                    id="new-faq-order"
                    type="number"
                    min="0"
                    value={newFaqForm.sort_order}
                    onChange={(e) => setNewFaqForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddingFaq(false)}>
                  Cancelar
                </Button>
                <Button onClick={createFaq}>
                  Criar FAQ
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {faqs.length === 0 ? (
            <div className="text-center py-8">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhuma pergunta frequente cadastrada ainda.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {faqs.map((faq) => (
                <Card key={faq.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    {editingFaq === faq.id ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`edit-question-${faq.id}`}>Pergunta</Label>
                          <Input
                            id={`edit-question-${faq.id}`}
                            value={faqEditForm.question}
                            onChange={(e) => setFaqEditForm(prev => ({ ...prev, question: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`edit-answer-${faq.id}`}>Resposta</Label>
                          <Textarea
                            id={`edit-answer-${faq.id}`}
                            value={faqEditForm.answer}
                            onChange={(e) => setFaqEditForm(prev => ({ ...prev, answer: e.target.value }))}
                            rows={4}
                          />
                        </div>
                         <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                           <div className="flex items-center space-x-2">
                             <Switch
                               id={`active-${faq.id}`}
                               checked={faqEditForm.is_active}
                               onCheckedChange={(checked) => setFaqEditForm(prev => ({ ...prev, is_active: checked }))}
                             />
                             <Label htmlFor={`active-${faq.id}`}>Ativa</Label>
                           </div>
                           <div className="w-full sm:w-auto">
                             <Label htmlFor={`edit-order-${faq.id}`}>Ordem</Label>
                             <Input
                               id={`edit-order-${faq.id}`}
                               type="number"
                               min="0"
                               value={faqEditForm.sort_order}
                               onChange={(e) => setFaqEditForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                               className="w-full sm:w-20"
                             />
                           </div>
                         </div>
                         <div className="flex flex-col sm:flex-row gap-2">
                           <Button onClick={() => updateFaq(faq.id)} size="sm" className="w-full sm:w-auto">
                             <Save className="h-4 w-4 mr-1" />
                             Salvar
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => setEditingFaq(null)}
                             className="w-full sm:w-auto"
                           >
                             <X className="h-4 w-4 mr-1" />
                             Cancelar
                           </Button>
                         </div>
                      </div>
                    ) : (
                       <div>
                         <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                           <h4 className="font-semibold text-base sm:text-lg break-words">{faq.question}</h4>
                           <div className="flex items-center gap-2 flex-shrink-0">
                             <Badge variant={faq.is_active ? 'default' : 'secondary'}>
                               {faq.is_active ? 'Ativa' : 'Inativa'}
                             </Badge>
                             <span className="text-xs text-muted-foreground">#{faq.sort_order}</span>
                           </div>
                         </div>
                         <p className="text-muted-foreground mb-4 whitespace-pre-wrap text-sm sm:text-base break-words">{faq.answer}</p>
                         <div className="flex flex-col sm:flex-row gap-2">
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => {
                               setEditingFaq(faq.id);
                               setFaqEditForm({
                                 question: faq.question,
                                 answer: faq.answer,
                                 is_active: faq.is_active,
                                 sort_order: faq.sort_order
                               });
                             }}
                             className="w-full sm:w-auto"
                           >
                             <Edit3 className="h-4 w-4 mr-1" />
                             Editar
                           </Button>
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => toggleFaqStatus(faq.id, faq.is_active)}
                             className="w-full sm:w-auto"
                           >
                             {faq.is_active ? (
                               <>
                                 <PowerOff className="h-4 w-4 mr-1" />
                                 Desativar
                               </>
                             ) : (
                               <>
                                 <Power className="h-4 w-4 mr-1" />
                                 Ativar
                               </>
                             )}
                           </Button>
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button variant="destructive" size="sm" className="w-full sm:w-auto">
                                 <Trash2 className="h-4 w-4 mr-1" />
                                 Excluir
                               </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent className="mx-4 max-w-lg">
                               <AlertDialogHeader>
                                 <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   Tem certeza que deseja excluir esta pergunta frequente?
                                   <br />
                                   <strong>Pergunta:</strong> {faq.question}
                                   <br />
                                   Esta ação não pode ser desfeita.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                 <AlertDialogAction
                                   onClick={() => deleteFaq(faq.id)}
                                   className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                 >
                                   Sim, excluir
                                 </AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                         </div>
                       </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Notifications Management */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
              <Mail className="h-5 w-5" />
              Notificações por Email
            </CardTitle>
            <p className={`text-muted-foreground mt-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              Gerencie os emails que recebem notificações de reservas criadas ou canceladas
            </p>
          </div>
          <Dialog open={addingEmail} onOpenChange={setAddingEmail}>
            <DialogTrigger asChild>
              <Button className={`flex items-center ${isMobile ? 'p-2' : 'gap-2'}`}>
                <Plus className="h-4 w-4" />
                {!isMobile && "Adicionar Email"}
              </Button>
            </DialogTrigger>
            <DialogContent className="mx-4 max-w-lg">
              <DialogHeader>
                <DialogTitle>Adicionar Email de Notificação</DialogTitle>
                <DialogDescription>
                  Adicione um email que receberá notificações quando reservas forem criadas ou canceladas.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="exemplo@email.com"
                    value={newEmailForm.email}
                    onChange={(e) => setNewEmailForm({ email: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={createNotificationEmail} className="flex-1">
                    Adicionar Email
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={async () => {
                      try {
                        console.log('🧪 Testing email notifications...');
                        const { data, error } = await supabase.functions.invoke('test-email-send');
                        if (error) {
                          console.error('Test error:', error);
                          toast({
                            title: "Erro no teste",
                            description: "Não foi possível executar o teste de emails.",
                            variant: "destructive"
                          });
                        } else {
                          console.log('Test result:', data);
                          toast({
                            title: "Teste enviado!",
                            description: `Emails de teste enviados para ${data.emailsFound} endereços.`
                          });
                        }
                      } catch (error) {
                        console.error('Test exception:', error);
                      }
                    }}
                  >
                    Testar
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setAddingEmail(false);
                    setNewEmailForm({ email: '' });
                  }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {notificationEmails.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhum email de notificação cadastrado.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione emails para receber notificações de reservas.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notificationEmails.map((emailItem) => (
                <Card key={emailItem.id} className={`${isMobile ? 'p-3' : 'p-4'}`}>
                  <CardContent className="p-0">
                    <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-center justify-between'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className={`font-medium ${isMobile ? 'text-sm' : ''}`}>
                            {emailItem.email}
                          </span>
                          <Badge variant={emailItem.is_active ? "default" : "secondary"} 
                                 className={isMobile ? 'text-xs' : ''}>
                            {emailItem.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <p className={`text-muted-foreground mt-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                          Adicionado em {new Date(emailItem.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className={`flex ${isMobile ? 'w-full flex-wrap gap-2' : 'items-center gap-2'}`}>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size={isMobile ? "sm" : "default"}
                              className={`${isMobile ? 'flex-1' : ''} flex items-center gap-1`}
                            >
                              <Settings className="h-4 w-4" />
                              {isMobile ? "Notificações" : "Gerenciar Notificações"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="mx-4 max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Configurar Notificações</DialogTitle>
                              <DialogDescription>
                                Escolha quais tipos de reserva este email deve receber notificações.
                                <br />
                                <strong>Email:</strong> {emailItem.email}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`notify-projector-${emailItem.id}`}
                                    checked={emailItem.notify_projector ?? true}
                                    onChange={(e) => updateNotificationPreferences(emailItem.id, 'notify_projector', e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <label htmlFor={`notify-projector-${emailItem.id}`} className="text-sm font-medium">
                                    📽️ Reservas de Projetor
                                  </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`notify-speaker-${emailItem.id}`}
                                    checked={emailItem.notify_speaker ?? true}
                                    onChange={(e) => updateNotificationPreferences(emailItem.id, 'notify_speaker', e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <label htmlFor={`notify-speaker-${emailItem.id}`} className="text-sm font-medium">
                                    🔊 Reservas de Caixa de Som
                                  </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`notify-laboratory-${emailItem.id}`}
                                    checked={emailItem.notify_laboratory ?? true}
                                    onChange={(e) => updateNotificationPreferences(emailItem.id, 'notify_laboratory', e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <label htmlFor={`notify-laboratory-${emailItem.id}`} className="text-sm font-medium">
                                    🧪 Reservas de Laboratório
                                  </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`notify-auditorium-${emailItem.id}`}
                                    checked={emailItem.notify_auditorium ?? true}
                                    onChange={(e) => updateNotificationPreferences(emailItem.id, 'notify_auditorium', e.target.checked)}
                                    className="rounded border-gray-300 text-primary focus:ring-primary"
                                  />
                                  <label htmlFor={`notify-auditorium-${emailItem.id}`} className="text-sm font-medium">
                                    🎭 Reservas de Auditório
                                  </label>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size={isMobile ? "sm" : "default"}
                          onClick={() => toggleNotificationEmailStatus(emailItem.id, emailItem.is_active)}
                          className={`${isMobile ? 'flex-1' : ''} flex items-center gap-1`}
                        >
                          {emailItem.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {emailItem.is_active ? "Desativar" : "Ativar"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size={isMobile ? "sm" : "default"} 
                                    className={`${isMobile ? 'flex-1' : ''}`}>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="mx-4 max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover este email da lista de notificações?
                                <br />
                                <strong>Email:</strong> {emailItem.email}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteNotificationEmail(emailItem.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Alerts Management */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
              <AlertCircle className="h-5 w-5" />
              Gerenciar Alertas
            </CardTitle>
            <p className={`text-muted-foreground mt-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              Crie alertas em mini pop-up que serão exibidos para os usuários
            </p>
          </div>
          <Dialog open={addingAlert} onOpenChange={setAddingAlert}>
            <DialogTrigger asChild>
              <Button className={`flex items-center ${isMobile ? 'p-2' : 'gap-2'}`}>
                <Plus className="h-4 w-4" />
                {!isMobile && "Criar Alerta"}
              </Button>
            </DialogTrigger>
            <DialogContent className="mx-4 max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Novo Alerta</DialogTitle>
                <DialogDescription>
                  Crie um alerta que será exibido em mini pop-up para os usuários.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="alert-title">Título</Label>
                  <Input
                    id="alert-title"
                    placeholder="Título do alerta"
                    value={newAlertForm.title}
                    onChange={(e) => setNewAlertForm({ ...newAlertForm, title: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alert-message">Mensagem</Label>
                  <Textarea
                    id="alert-message"
                    placeholder="Mensagem do alerta"
                    value={newAlertForm.message}
                    onChange={(e) => setNewAlertForm({ ...newAlertForm, message: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alert-duration">Duração (segundos)</Label>
                  <Input
                    id="alert-duration"
                    type="number"
                    min="1"
                    max="30"
                    value={newAlertForm.duration || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewAlertForm({ 
                        ...newAlertForm, 
                        duration: value === '' ? '' : parseInt(value) || 5 
                      });
                    }}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alert-expires">Data de Expiração (opcional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newAlertForm.expires_at
                          ? format(newAlertForm.expires_at, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : "Sem expiração"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto max-w-sm p-0" align="start">
                      <div className="p-3">
                        <Calendar
                          mode="single"
                          selected={newAlertForm.expires_at}
                          onSelect={(date) => {
                            if (date) {
                              const now = new Date();
                              date.setHours(now.getHours() + 1);
                              date.setMinutes(0);
                            }
                            setNewAlertForm({ ...newAlertForm, expires_at: date });
                          }}
                          disabled={(date) => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const compareDate = new Date(date);
                            compareDate.setHours(0, 0, 0, 0);
                            return compareDate < today;
                          }}
                          initialFocus
                          className="pointer-events-auto"
                        />
                        {newAlertForm.expires_at && (
                          <div className="mt-3 space-y-2 border-t pt-3">
                            <Label className="text-sm">Horário</Label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="23"
                                value={newAlertForm.expires_at.getHours()}
                                onChange={(e) => {
                                  const newDate = new Date(newAlertForm.expires_at!);
                                  newDate.setHours(parseInt(e.target.value) || 0);
                                  setNewAlertForm({ ...newAlertForm, expires_at: newDate });
                                }}
                                className="w-20"
                                placeholder="HH"
                              />
                              <span className="flex items-center">:</span>
                              <Input
                                type="number"
                                min="0"
                                max="59"
                                step="15"
                                value={tempMinutes}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setTempMinutes(value);
                                  
                                  if (value === '') return;
                                  
                                  const minutes = parseInt(value);
                                  if (!isNaN(minutes) && minutes >= 0 && minutes <= 59) {
                                    const newDate = new Date(newAlertForm.expires_at!);
                                    newDate.setMinutes(minutes);
                                    setNewAlertForm({ ...newAlertForm, expires_at: newDate });
                                  }
                                }}
                                className="w-20"
                                placeholder="MM"
                              />
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setNewAlertForm({ ...newAlertForm, expires_at: null })}
                              className="w-full"
                            >
                              Remover Expiração
                            </Button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createAlert}>Criar Alerta</Button>
                <Button variant="outline" onClick={() => {
                  setAddingAlert(false);
                  setNewAlertForm({ title: '', message: '', duration: 5, expires_at: null });
                }}>
                  Cancelar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {adminAlerts.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhum alerta criado.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie alertas para informar os usuários sobre novidades.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {adminAlerts.map((alert) => (
                <Card key={alert.id} className={`${isMobile ? 'p-3' : 'p-4'}`}>
                  <CardContent className="p-0">
                    {editingAlert === alert.id ? (
                      <div className="space-y-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`edit-title-${alert.id}`}>Título</Label>
                          <Input
                            id={`edit-title-${alert.id}`}
                            value={alertEditForm.title}
                            onChange={(e) => setAlertEditForm({ ...alertEditForm, title: e.target.value })}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`edit-message-${alert.id}`}>Mensagem</Label>
                          <Textarea
                            id={`edit-message-${alert.id}`}
                            value={alertEditForm.message}
                            onChange={(e) => setAlertEditForm({ ...alertEditForm, message: e.target.value })}
                            rows={3}
                          />
                        </div>
                         <div className="grid gap-2">
                           <Label htmlFor={`edit-duration-${alert.id}`}>Duração (segundos)</Label>
                            <Input
                              id={`edit-duration-${alert.id}`}
                              type="number"
                              min="1"
                              max="30"
                              value={alertEditForm.duration || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setAlertEditForm({ 
                                  ...alertEditForm, 
                                  duration: value === '' ? '' : parseInt(value) || 5 
                                });
                              }}
                            />
                         </div>
                         <div className="grid gap-2">
                           <Label htmlFor={`edit-expires-${alert.id}`}>Data de Expiração</Label>
                           <Popover>
                             <PopoverTrigger asChild>
                               <Button
                                 variant="outline"
                                 className="w-full justify-start text-left font-normal"
                               >
                                 <CalendarIcon className="mr-2 h-4 w-4" />
                                 {alertEditForm.expires_at
                                   ? format(alertEditForm.expires_at, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                   : "Sem expiração"}
                               </Button>
                             </PopoverTrigger>
                              <PopoverContent className="w-auto max-w-sm p-0" align="start">
                                <div className="p-3">
                                  <Calendar
                                    mode="single"
                                    selected={alertEditForm.expires_at}
                                    onSelect={(date) => {
                                      if (date && !alertEditForm.expires_at) {
                                        const now = new Date();
                                        date.setHours(now.getHours() + 1);
                                        date.setMinutes(0);
                                      }
                                      setAlertEditForm({ ...alertEditForm, expires_at: date });
                                    }}
                                    disabled={(date) => {
                                      const today = new Date();
                                      today.setHours(0, 0, 0, 0);
                                      const compareDate = new Date(date);
                                      compareDate.setHours(0, 0, 0, 0);
                                      return compareDate < today;
                                    }}
                                    initialFocus
                                    className="pointer-events-auto"
                                  />
                                 {alertEditForm.expires_at && (
                                   <div className="mt-3 space-y-2 border-t pt-3">
                                     <Label className="text-sm">Horário</Label>
                                     <div className="flex gap-2">
                                       <Input
                                         type="number"
                                         min="0"
                                         max="23"
                                         value={alertEditForm.expires_at.getHours()}
                                         onChange={(e) => {
                                           const newDate = new Date(alertEditForm.expires_at!);
                                           newDate.setHours(parseInt(e.target.value) || 0);
                                           setAlertEditForm({ ...alertEditForm, expires_at: newDate });
                                         }}
                                         className="w-20"
                                         placeholder="HH"
                                       />
                                       <span className="flex items-center">:</span>
                                        <Input
                                          type="number"
                                          min="0"
                                          max="59"
                                          step="15"
                                          value={tempEditMinutes}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            setTempEditMinutes(value);
                                            
                                            if (value === '') return;
                                            
                                            const minutes = parseInt(value);
                                            if (!isNaN(minutes) && minutes >= 0 && minutes <= 59) {
                                              const newDate = new Date(alertEditForm.expires_at!);
                                              newDate.setMinutes(minutes);
                                              setAlertEditForm({ ...alertEditForm, expires_at: newDate });
                                            }
                                          }}
                                          className="w-20"
                                          placeholder="MM"
                                        />
                                     </div>
                                     <Button
                                       variant="outline"
                                       size="sm"
                                       onClick={() => setAlertEditForm({ ...alertEditForm, expires_at: null })}
                                       className="w-full"
                                     >
                                       Remover Expiração
                                     </Button>
                                   </div>
                                 )}
                               </div>
                             </PopoverContent>
                           </Popover>
                         </div>
                         <div className="flex items-center space-x-2">
                           <Switch
                             checked={alertEditForm.is_active}
                             onCheckedChange={(checked) => setAlertEditForm({ ...alertEditForm, is_active: checked })}
                           />
                           <Label>Ativo</Label>
                         </div>
                        <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'gap-2'}`}>
                          <Button onClick={() => updateAlert(alert.id)} className={isMobile ? 'w-full' : ''}>
                            <Save className="h-4 w-4 mr-1" />
                            Salvar
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setEditingAlert(null)}
                            className={isMobile ? 'w-full' : ''}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-start justify-between'}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className={`font-semibold ${isMobile ? 'text-sm' : ''}`}>
                              {alert.title}
                            </h4>
                            <Badge variant={alert.is_active ? "default" : "secondary"} 
                                   className={isMobile ? 'text-xs' : ''}>
                              {alert.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <p className={`text-muted-foreground mb-2 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            {alert.message}
                          </p>
                          <div className={`flex ${isMobile ? 'flex-col gap-1' : 'gap-4'} text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            <span>Duração: {alert.duration}s</span>
                            <span>Criado: {new Date(alert.created_at).toLocaleDateString('pt-BR')}</span>
                            {alert.expires_at && (
                              <span className={
                                new Date(alert.expires_at) < new Date()
                                  ? "text-red-500 font-medium"
                                  : new Date(alert.expires_at) < new Date(Date.now() + 24 * 60 * 60 * 1000)
                                  ? "text-yellow-600 font-medium"
                                  : ""
                              }>
                                {new Date(alert.expires_at) < new Date()
                                  ? "Expirado"
                                  : `Expira: ${format(new Date(alert.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`flex ${isMobile ? 'w-full flex-col space-y-2' : 'items-center gap-2'}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingAlert(alert.id);
                              setAlertEditForm({
                                title: alert.title,
                                message: alert.message,
                                duration: alert.duration,
                                is_active: alert.is_active,
                                expires_at: alert.expires_at ? new Date(alert.expires_at) : null
                              });
                            }}
                            className={isMobile ? 'w-full' : ''}
                          >
                            <Edit3 className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAlertStatus(alert.id, alert.is_active)}
                            className={isMobile ? 'w-full' : ''}
                          >
                            {alert.is_active ? (
                              <>
                                <PowerOff className="h-4 w-4 mr-1" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <Power className="h-4 w-4 mr-1" />
                                Ativar
                              </>
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" className={isMobile ? 'w-full' : ''}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="mx-4 max-w-lg">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir este alerta?
                                  <br />
                                  <strong>Título:</strong> {alert.title}
                                  <br />
                                  Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteAlert(alert.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Sim, excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Green Tag Dialog */}
      <Dialog open={greenTagDialogOpen} onOpenChange={setGreenTagDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="green-tag-text">
                Texto da Tag ({selectedUser?.display_name})
              </Label>
              <Input
                id="green-tag-text"
                placeholder="Digite o texto da tag (ex: VIP, Premium, Gold)"
                value={greenTagText}
                onChange={(e) => setGreenTagText(e.target.value)}
                maxLength={20}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para remover a tag. Máximo 20 caracteres.
              </p>
              {greenTagText.trim() && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm">Pré-visualização:</span>
                  <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {greenTagText.trim()}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={saveGreenTagText}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Classroom Management Dialog */}
      <Dialog open={classroomDialogOpen} onOpenChange={setClassroomDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gestão de Salas</DialogTitle>
            <DialogDescription>
              Configure as salas para cada dia da semana.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="monday">Segunda-feira</Label>
              <Input
                id="monday"
                value={classroomData.monday}
                onChange={(e) => setClassroomData(prev => ({ ...prev, monday: e.target.value }))}
                placeholder="Ex: S-20, LAB 1..."
              />
            </div>
            <div>
              <Label htmlFor="tuesday">Terça-feira</Label>
              <Input
                id="tuesday"
                value={classroomData.tuesday}
                onChange={(e) => setClassroomData(prev => ({ ...prev, tuesday: e.target.value }))}
                placeholder="Ex: S-20, LAB 1..."
              />
            </div>
            <div>
              <Label htmlFor="wednesday">Quarta-feira</Label>
              <Input
                id="wednesday"
                value={classroomData.wednesday}
                onChange={(e) => setClassroomData(prev => ({ ...prev, wednesday: e.target.value }))}
                placeholder="Ex: S-20, LAB 1..."
              />
            </div>
            <div>
              <Label htmlFor="thursday">Quinta-feira</Label>
              <Input
                id="thursday"
                value={classroomData.thursday}
                onChange={(e) => setClassroomData(prev => ({ ...prev, thursday: e.target.value }))}
                placeholder="Ex: S-20, LAB 1..."
              />
            </div>
            <div>
              <Label htmlFor="friday">Sexta-feira</Label>
              <Input
                id="friday"
                value={classroomData.friday}
                onChange={(e) => setClassroomData(prev => ({ ...prev, friday: e.target.value }))}
                placeholder="Ex: S-20, LAB 1..."
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setClassroomDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleClassroomSave}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Management Section */}
      <ErrorBoundary>
        <EmailManagement />
      </ErrorBoundary>

    </div>
  );
}