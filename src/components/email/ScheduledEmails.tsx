import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, Edit, Trash2, Clock, Play, Pause } from "lucide-react";

interface ScheduledEmail {
  id: string;
  name: string;
  subject: string;
  content: string;
  target_emails: any;
  schedule_type: string;
  schedule_time: string;
  schedule_days: number[];
  is_active: boolean;
  last_sent: string | null;
  created_at: string;
}

interface ScheduledEmailForm {
  name: string;
  subject: string;
  content: string;
  target_emails: any;
  schedule_type: string;
  schedule_time: string;
  schedule_days: number[];
}

const SCHEDULE_TYPES = [
  { value: "daily", label: "Diário" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" }
];

const WEEK_DAYS = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" }
];

export const ScheduledEmails = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmail, setEditingEmail] = useState<ScheduledEmail | null>(null);
  const [formData, setFormData] = useState<ScheduledEmailForm>({
    name: "",
    subject: "",
    content: "",
    target_emails: "all",
    schedule_type: "daily",
    schedule_time: "09:00",
    schedule_days: []
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Fetch scheduled emails
  const { data: scheduledEmails, isLoading } = useQuery({
    queryKey: ["scheduled-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_emails")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as ScheduledEmail[];
    }
  });

  // Fetch teachers for targeting
  const { data: teachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_emails")
        .select("id, name, email, department")
        .eq("is_active", true);
      
      if (error) throw error;
      return data;
    }
  });

  // Add/Update scheduled email mutation
  const emailMutation = useMutation({
    mutationFn: async (email: ScheduledEmailForm) => {
      if (editingEmail) {
        const { error } = await supabase
          .from("scheduled_emails")
          .update(email)
          .eq("id", editingEmail.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("scheduled_emails")
          .insert([email]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-emails"] });
      toast({
        title: "Sucesso",
        description: editingEmail ? "Campanha atualizada com sucesso!" : "Campanha criada com sucesso!"
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar campanha",
        variant: "destructive"
      });
    }
  });

  // Delete scheduled email mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduled_emails")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-emails"] });
      toast({
        title: "Sucesso",
        description: "Campanha removida com sucesso!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover campanha",
        variant: "destructive"
      });
    }
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("scheduled_emails")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-emails"] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    emailMutation.mutate(formData);
  };

  const handleEdit = (email: ScheduledEmail) => {
    setEditingEmail(email);
    setFormData({
      name: email.name,
      subject: email.subject,
      content: email.content,
      target_emails: email.target_emails,
      schedule_type: email.schedule_type,
      schedule_time: email.schedule_time,
      schedule_days: email.schedule_days || []
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingEmail(null);
    setFormData({
      name: "",
      subject: "",
      content: "",
      target_emails: "all",
      schedule_type: "daily",
      schedule_time: "09:00",
      schedule_days: []
    });
  };

  const handleScheduleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      schedule_days: prev.schedule_days.includes(day)
        ? prev.schedule_days.filter(d => d !== day)
        : [...prev.schedule_days, day]
    }));
  };

  const formatScheduleInfo = (email: ScheduledEmail) => {
    let info = `${email.schedule_time}`;
    
    if (email.schedule_type === "weekly" && email.schedule_days) {
      const dayNames = email.schedule_days.map(d => 
        WEEK_DAYS.find(wd => wd.value === d)?.label
      ).filter(Boolean);
      info += ` (${dayNames.join(", ")})`;
    } else if (email.schedule_type === "monthly" && email.schedule_days) {
      info += ` (dias ${email.schedule_days.join(", ")})`;
    }
    
    return info;
  };

  if (isLoading) {
    return <div className="flex justify-center p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'flex-row justify-between items-center'}`}>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size={isMobile ? "sm" : "default"}>
              <Plus className="h-4 w-4 mr-2" />
              {isMobile ? "Nova Campanha" : "Nova Campanha Programada"}
            </Button>
          </DialogTrigger>
          <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] overflow-y-auto' : 'sm:max-w-[600px]'}`}>
            <DialogHeader>
              <DialogTitle>
                {editingEmail ? "Editar Campanha" : "Nova Campanha Programada"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome da Campanha *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="schedule_time">Horário *</Label>
                  <Input
                    id="schedule_time"
                    type="time"
                    value={formData.schedule_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, schedule_time: e.target.value }))}
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="subject">Assunto *</Label>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="content">Conteúdo *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  className="min-h-[100px]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Agendamento *</Label>
                  <Select value={formData.schedule_type} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, schedule_type: value, schedule_days: [] }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Destinatários</Label>
                  <Select value={formData.target_emails === "all" ? "all" : "specific"} 
                          onValueChange={(value) => 
                            setFormData(prev => ({ ...prev, target_emails: value === "all" ? "all" : [] }))
                          }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os professores</SelectItem>
                      <SelectItem value="specific">Professores específicos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.schedule_type === "weekly" && (
                <div>
                  <Label>Dias da Semana</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {WEEK_DAYS.map(day => (
                      <div key={day.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`day-${day.value}`}
                          checked={formData.schedule_days.includes(day.value)}
                          onCheckedChange={() => handleScheduleDayToggle(day.value)}
                        />
                        <Label htmlFor={`day-${day.value}`} className="text-sm">
                          {day.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {formData.schedule_type === "monthly" && (
                <div>
                  <Label htmlFor="monthly_days">Dias do Mês (separados por vírgula)</Label>
                  <Input
                    id="monthly_days"
                    placeholder="Ex: 1, 15, 30"
                    value={formData.schedule_days.join(", ")}
                    onChange={(e) => {
                      const days = e.target.value.split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d) && d >= 1 && d <= 31);
                      setFormData(prev => ({ ...prev, schedule_days: days }));
                    }}
                  />
                </div>
              )}

              {/* Seleção de professores específicos */}
              {formData.target_emails !== "all" && Array.isArray(formData.target_emails) && (
                <div>
                  <Label>Selecionar Professores</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2 mb-2">
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          if (teachers) {
                            setFormData(prev => ({ 
                              ...prev, 
                              target_emails: teachers.map(t => t.id) 
                            }));
                          }
                        }}
                      >
                        Selecionar Todos
                      </Button>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, target_emails: [] }));
                        }}
                      >
                        Desmarcar Todos
                      </Button>
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                      {teachers?.map(teacher => (
                        <div key={teacher.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`teacher-${teacher.id}`}
                            checked={formData.target_emails.includes(teacher.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData(prev => ({ 
                                  ...prev, 
                                  target_emails: [...prev.target_emails, teacher.id] 
                                }));
                              } else {
                                setFormData(prev => ({ 
                                  ...prev, 
                                  target_emails: prev.target_emails.filter((id: string) => id !== teacher.id) 
                                }));
                              }
                            }}
                          />
                          <Label htmlFor={`teacher-${teacher.id}`} className="text-sm">
                            {teacher.name} ({teacher.email})
                            {teacher.department && (
                              <span className="text-muted-foreground ml-1">- {teacher.department}</span>
                            )}
                          </Label>
                        </div>
                      ))}
                    </div>
                    
                    {Array.isArray(formData.target_emails) && (
                      <div className="text-sm text-muted-foreground">
                        {formData.target_emails.length} professor(es) selecionado(s)
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={emailMutation.isPending}>
                  {emailMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="text-sm text-muted-foreground">
          Total: {scheduledEmails?.length || 0} campanhas
        </div>
      </div>

      {/* Scheduled Emails List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scheduledEmails?.map((email) => (
          <Card key={email.id} className={`${isMobile ? 'p-3' : 'p-4'}`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{email.name}</h3>
                <Badge variant={email.is_active ? "default" : "secondary"}>
                  {email.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              
              <div className="space-y-2 text-xs text-muted-foreground">
                <div>
                  <strong>Assunto:</strong> {email.subject}
                </div>
                <div>
                  <strong>Tipo:</strong> {SCHEDULE_TYPES.find(t => t.value === email.schedule_type)?.label}
                </div>
                <div>
                  <strong>Horário:</strong> {formatScheduleInfo(email)}
                </div>
                {email.last_sent && (
                  <div>
                    <strong>Último envio:</strong> {new Date(email.last_sent).toLocaleString("pt-BR")}
                  </div>
                )}
              </div>

              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => handleEdit(email)}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant={email.is_active ? "secondary" : "default"}
                  onClick={() => toggleActiveMutation.mutate({ id: email.id, isActive: email.is_active })}
                >
                  {email.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(email.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {scheduledEmails?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma campanha programada. Clique em "Nova Campanha" para começar.
        </div>
      )}
    </div>
  );
};