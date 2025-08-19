import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Send, Eye, Users, Filter, Clock } from "lucide-react";

interface ManualSendForm {
  subject: string;
  content: string;
  sendToAll: boolean;
  selectedTeachers: string[];
  department: string;
}

interface SendProgress {
  total: number;
  sent: number;
  failed: number;
  isActive: boolean;
}

export const ManualSend = () => {
  const [formData, setFormData] = useState<ManualSendForm>({
    subject: "",
    content: "",
    sendToAll: true,
    selectedTeachers: [],
    department: ""
  });
  const [sendProgress, setSendProgress] = useState<SendProgress>({
    total: 0,
    sent: 0,
    failed: 0,
    isActive: false
  });
  const [previewMode, setPreviewMode] = useState(false);
  
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Fetch teachers
  const { data: teachers, isLoading: loadingTeachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_emails")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (error) throw error;
      return data;
    }
  });

  // Get unique departments (safe when teachers is undefined)
  const departments = React.useMemo(
    () => Array.from(new Set((teachers ?? []).map((t: any) => t.department).filter(Boolean))),
    [teachers]
  );

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const { data, error } = await supabase.functions.invoke('send-bulk-email', {
        body: emailData
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSendProgress({
        total: data.summary.total,
        sent: data.summary.sent,
        failed: data.summary.failed,
        isActive: false
      });
      
      toast({
        title: "Envio Concluído!",
        description: `${data.summary.sent} emails enviados com sucesso de ${data.summary.total} total.`
      });
      
      // Reset form
      setFormData({
        subject: "",
        content: "",
        sendToAll: true,
        selectedTeachers: [],
        department: ""
      });
    },
    onError: (error: any) => {
      setSendProgress(prev => ({ ...prev, isActive: false }));
      toast({
        title: "Erro no Envio",
        description: error.message || "Erro ao enviar emails",
        variant: "destructive"
      });
    }
  });

  const handleTeacherToggle = (teacherId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTeachers: prev.selectedTeachers.includes(teacherId)
        ? prev.selectedTeachers.filter(id => id !== teacherId)
        : [...prev.selectedTeachers, teacherId]
    }));
  };

  const handleSelectAll = () => {
    if (!teachers) return;
    
    const filteredTeachers = formData.department 
      ? teachers.filter(t => t.department === formData.department)
      : teachers;
    
    setFormData(prev => ({
      ...prev,
      selectedTeachers: filteredTeachers.map(t => t.id)
    }));
  };

  const handleDeselectAll = () => {
    setFormData(prev => ({ ...prev, selectedTeachers: [] }));
  };

  const getSelectedTeachers = () => {
    if (!teachers) return [];
    
    if (formData.sendToAll) {
      return formData.department 
        ? teachers.filter(t => t.department === formData.department)
        : teachers;
    }
    
    return teachers.filter(t => formData.selectedTeachers.includes(t.id));
  };

  const handleSend = async () => {
    if (!formData.subject || !formData.content) {
      toast({
        title: "Campos Obrigatórios",
        description: "Preencha o assunto e conteúdo do email",
        variant: "destructive"
      });
      return;
    }

    const selectedTeachers = getSelectedTeachers();
    if (selectedTeachers.length === 0) {
      toast({
        title: "Nenhum Destinatário",
        description: "Selecione pelo menos um professor para enviar",
        variant: "destructive"
      });
      return;
    }

    setSendProgress({
      total: selectedTeachers.length,
      sent: 0,
      failed: 0,
      isActive: true
    });

    const emailData = {
      subject: formData.subject,
      content: formData.content,
      sendToAll: formData.sendToAll,
      recipientIds: formData.sendToAll ? undefined : formData.selectedTeachers,
      department: formData.department || undefined,
      isManual: true
    };

    sendMutation.mutate(emailData);
  };

  const selectedTeachersCount = getSelectedTeachers().length;
  const progressPercentage = sendProgress.total > 0 
    ? ((sendProgress.sent + sendProgress.failed) / sendProgress.total) * 100 
    : 0;

  if (loadingTeachers) {
    return <div className="flex justify-center p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      {sendProgress.isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Enviando Emails...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress value={progressPercentage} />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  Enviados: {sendProgress.sent} | Falhas: {sendProgress.failed}
                </span>
                <span>
                  {sendProgress.sent + sendProgress.failed} de {sendProgress.total}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <div className={`grid ${isMobile ? 'grid-cols-1 space-y-4' : 'grid-cols-1 md:grid-cols-2'} gap-6`}>
        {/* Left Column - Form */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="subject">Assunto *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Digite o assunto do email"
              disabled={sendProgress.isActive}
            />
          </div>

          <div>
            <Label htmlFor="content">Conteúdo *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Digite o conteúdo do email (pode usar HTML)"
              className="min-h-[200px]"
              disabled={sendProgress.isActive}
            />
          </div>

          {/* Recipients Selection */}
          <div className="space-y-4">
            <Label>Destinatários</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendToAll"
                checked={formData.sendToAll}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sendToAll: !!checked }))}
                disabled={sendProgress.isActive}
              />
              <Label htmlFor="sendToAll">Enviar para todos os professores ativos</Label>
            </div>

            {departments.length > 0 && (
              <div>
                <Label>Filtrar por Departamento</Label>
                <Select 
                  value={formData.department} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, department: value }))}
                  disabled={sendProgress.isActive}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os departamentos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos os departamentos</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!formData.sendToAll && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
                    Selecionar Todos
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleDeselectAll}>
                    Desmarcar Todos
                  </Button>
                </div>
                
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                  {teachers?.filter(t => !formData.department || t.department === formData.department).map(teacher => (
                    <div key={teacher.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`teacher-${teacher.id}`}
                        checked={formData.selectedTeachers.includes(teacher.id)}
                        onCheckedChange={() => handleTeacherToggle(teacher.id)}
                        disabled={sendProgress.isActive}
                      />
                      <Label htmlFor={`teacher-${teacher.id}`} className="text-sm">
                        {teacher.name} ({teacher.email})
                        {teacher.department && <span className="text-muted-foreground"> - {teacher.department}</span>}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              <Users className="h-4 w-4 inline mr-1" />
              {selectedTeachersCount} destinatário(s) selecionado(s)
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSend} 
              disabled={sendProgress.isActive || selectedTeachersCount === 0}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              {sendProgress.isActive ? "Enviando..." : `Enviar (${selectedTeachersCount})`}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setPreviewMode(!previewMode)}
              disabled={sendProgress.isActive}
            >
              <Eye className="h-4 w-4 mr-2" />
              {previewMode ? "Editar" : "Preview"}
            </Button>
          </div>
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-4">
          {isMobile ? (
            <Tabs value={previewMode ? "preview" : "edit"} onValueChange={(value) => setPreviewMode(value === "preview")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit">✏️ Editar</TabsTrigger>
                <TabsTrigger value="preview">👁️ Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="preview">
                <Card>
                  <CardHeader>
                    <CardTitle>Preview do Email</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <strong>Para:</strong> {selectedTeachersCount} destinatário(s)
                      </div>
                      <div>
                        <strong>Assunto:</strong> {formData.subject || <em>Digite o assunto</em>}
                      </div>
                      <div className="border rounded-lg p-4 min-h-[200px] bg-background">
                        {formData.content ? (
                          <div dangerouslySetInnerHTML={{ __html: formData.content }} />
                        ) : (
                          <em className="text-muted-foreground">Digite o conteúdo</em>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Preview do Email</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <strong>Para:</strong> {selectedTeachersCount} destinatário(s)
                  </div>
                  <div>
                    <strong>Assunto:</strong> {formData.subject || <em>Digite o assunto</em>}
                  </div>
                  <div className="border rounded-lg p-4 min-h-[200px] bg-background">
                    {formData.content ? (
                      <div dangerouslySetInnerHTML={{ __html: formData.content }} />
                    ) : (
                      <em className="text-muted-foreground">Digite o conteúdo</em>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};