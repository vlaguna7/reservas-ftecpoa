import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { Mail, Users, Clock, BarChart3 } from "lucide-react";
import { TeacherManagement } from "./email/TeacherManagement";
import { ScheduledEmails } from "./email/ScheduledEmails";
import { ManualSend } from "./email/ManualSend";
import { EmailReports } from "./email/EmailReports";

export const EmailManagement = () => {
  const [activeTab, setActiveTab] = useState("teachers");
  const isMobile = useIsMobile();

  const tabs = [
    {
      id: "teachers",
      label: "Gerenciar Professores",
      shortLabel: "Professores",
      icon: Users,
      description: "Cadastre e gerencie emails dos professores"
    },
    {
      id: "scheduled",
      label: "Disparos Automáticos",
      shortLabel: "Automático",
      icon: Clock,
      description: "Configure campanhas programadas"
    },
    {
      id: "manual",
      label: "Disparo Manual",
      shortLabel: "Manual",
      icon: Mail,
      description: "Envie emails instantaneamente"
    },
    {
      id: "reports",
      label: "Relatórios",
      shortLabel: "Relatórios",
      icon: BarChart3,
      description: "Visualize estatísticas e logs"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          📧 Dashboard de Email
        </h2>
        <p className="text-muted-foreground">
          Gerencie comunicações por email com professores e configure disparos automáticos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className={`${isMobile ? 'w-full overflow-x-auto' : ''}`}>
          <TabsList className={`${isMobile ? 'min-w-max gap-1 border-b' : 'gap-2 border-b'}`}>
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className={`${isMobile ? 'text-xs px-3 py-2' : 'px-4 py-2'} whitespace-nowrap flex items-center gap-2`}
              >
                <tab.icon className="h-4 w-4" />
                {isMobile ? tab.shortLabel : tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="teachers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gerenciar Professores
              </CardTitle>
              <CardDescription>
                Cadastre, edite e gerencie os emails dos professores para envio de notificações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TeacherManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Disparos Automáticos
              </CardTitle>
              <CardDescription>
                Configure campanhas de email programadas para envio automático
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScheduledEmails />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Disparo Manual
              </CardTitle>
              <CardDescription>
                Envie emails instantaneamente para professores selecionados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManualSend />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Relatórios e Estatísticas
              </CardTitle>
              <CardDescription>
                Visualize métricas de envio, taxa de sucesso e logs detalhados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailReports />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};