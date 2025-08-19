import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, Edit, Trash2, Upload, Download } from "lucide-react";

interface Teacher {
  id: string;
  name: string;
  email: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
}

interface TeacherForm {
  name: string;
  email: string;
  department: string;
}

export const TeacherManagement = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [formData, setFormData] = useState<TeacherForm>({
    name: "",
    email: "",
    department: ""
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Fetch teachers
  const { data: teachers, isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_emails")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Teacher[];
    }
  });

  // Add/Update teacher mutation
  const teacherMutation = useMutation({
    mutationFn: async (teacher: TeacherForm) => {
      if (editingTeacher) {
        const { error } = await supabase
          .from("teacher_emails")
          .update(teacher)
          .eq("id", editingTeacher.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("teacher_emails")
          .insert([teacher]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast({
        title: "Sucesso",
        description: editingTeacher ? "Professor atualizado com sucesso!" : "Professor adicionado com sucesso!"
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar professor",
        variant: "destructive"
      });
    }
  });

  // Delete teacher mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("teacher_emails")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast({
        title: "Sucesso",
        description: "Professor removido com sucesso!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao remover professor",
        variant: "destructive"
      });
    }
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("teacher_emails")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    teacherMutation.mutate(formData);
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name,
      email: teacher.email,
      department: teacher.department || ""
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTeacher(null);
    setFormData({ name: "", email: "", department: "" });
  };

  const handleExportCSV = () => {
    if (!teachers) return;
    
    const csvContent = [
      ["Nome", "Email", "Departamento", "Status"].join(","),
      ...teachers.map(t => [
        t.name,
        t.email,
        t.department || "",
        t.is_active ? "Ativo" : "Inativo"
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "professores.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="flex justify-center p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header Actions */}
      <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'flex-row justify-between items-center'}`}>
        <div className="flex flex-wrap gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size={isMobile ? "sm" : "default"}>
                <Plus className="h-4 w-4 mr-2" />
                {isMobile ? "Adicionar" : "Adicionar Professor"}
              </Button>
            </DialogTrigger>
            <DialogContent className={`${isMobile ? 'max-w-[95vw] max-h-[90vh] overflow-y-auto' : 'sm:max-w-[500px]'}`}>
              <DialogHeader>
                <DialogTitle>
                  {editingTeacher ? "Editar Professor" : "Adicionar Professor"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={teacherMutation.isPending}>
                    {teacherMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            {isMobile ? "CSV" : "Exportar CSV"}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground">
          Total: {teachers?.length || 0} professores
        </div>
      </div>

      {/* Teachers List */}
      {isMobile ? (
        <div className="space-y-2">
          {teachers?.map((teacher) => (
            <Card key={teacher.id} className="p-3">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{teacher.name}</span>
                  <Badge variant={teacher.is_active ? "default" : "secondary"} className="text-xs">
                    {teacher.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {teacher.email}
                </div>
                {teacher.department && (
                  <div className="text-xs text-muted-foreground">
                    Dept: {teacher.department}
                  </div>
                )}
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleEdit(teacher)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant={teacher.is_active ? "secondary" : "default"} 
                    className="h-7 px-2"
                    onClick={() => toggleActiveMutation.mutate({ id: teacher.id, isActive: teacher.is_active })}
                  >
                    {teacher.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="h-7 px-2"
                    onClick={() => deleteMutation.mutate(teacher.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers?.map((teacher) => (
              <TableRow key={teacher.id}>
                <TableCell className="font-medium">{teacher.name}</TableCell>
                <TableCell>{teacher.email}</TableCell>
                <TableCell>{teacher.department || "-"}</TableCell>
                <TableCell>
                  <Badge variant={teacher.is_active ? "default" : "secondary"}>
                    {teacher.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(teacher)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant={teacher.is_active ? "secondary" : "default"}
                      onClick={() => toggleActiveMutation.mutate({ id: teacher.id, isActive: teacher.is_active })}
                    >
                      {teacher.is_active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(teacher.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {teachers?.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum professor cadastrado. Clique em "Adicionar Professor" para começar.
        </div>
      )}
    </div>
  );
};