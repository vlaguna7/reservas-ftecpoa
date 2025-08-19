import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { Mail, TrendingUp, AlertCircle, Clock, Download, Filter } from "lucide-react";

interface EmailLog {
  id: string;
  email: string;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  is_manual: boolean;
}

interface EmailStats {
  totalSent: number;
  totalFailed: number;
  todaySent: number;
  successRate: number;
  recentActivity: EmailLog[];
}

export const EmailReports = () => {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchEmail, setSearchEmail] = useState("");
  const [dateRange, setDateRange] = useState("7"); // days
  
  const isMobile = useIsMobile();

  // Fetch email logs with filters
  const { data: emailLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["email-logs", filterStatus, filterType, searchEmail, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("email_logs")
        .select("*")
        .order("sent_at", { ascending: false });

      // Apply date filter
      if (dateRange !== "all") {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
        query = query.gte("sent_at", daysAgo.toISOString());
      }

      // Apply status filter
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      // Apply type filter
      if (filterType !== "all") {
        query = query.eq("is_manual", filterType === "manual");
      }

      // Apply email search
      if (searchEmail) {
        query = query.ilike("email", `%${searchEmail}%`);
      }

      const { data, error } = await query.limit(100);
      
      if (error) throw error;
      return data as EmailLog[];
    }
  });

  // Calculate statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["email-stats"],
    queryFn: async () => {
      // Get total counts
      const { count: totalSent } = await supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent");

      const { count: totalFailed } = await supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");

      // Get today's count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: todaySent } = await supabase
        .from("email_logs")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("sent_at", today.toISOString());

      // Get recent activity
      const { data: recentActivity } = await supabase
        .from("email_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(5);

      const successRate = totalSent && (totalSent + totalFailed) 
        ? (totalSent / (totalSent + totalFailed)) * 100 
        : 0;

      return {
        totalSent: totalSent || 0,
        totalFailed: totalFailed || 0,
        todaySent: todaySent || 0,
        successRate: Math.round(successRate * 100) / 100,
        recentActivity: recentActivity || []
      } as EmailStats;
    }
  });

  const handleExportLogs = () => {
    if (!emailLogs) return;
    
    const csvContent = [
      ["Data/Hora", "Email", "Assunto", "Status", "Tipo", "Erro"].join(","),
      ...emailLogs.map(log => [
        new Date(log.sent_at).toLocaleString("pt-BR"),
        log.email,
        log.subject,
        log.status,
        log.is_manual ? "Manual" : "Automático",
        log.error_message || ""
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `email-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (statsLoading) {
    return <div className="flex justify-center p-4">Carregando estatísticas...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Enviados</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSent || 0}</div>
            <p className="text-xs text-muted-foreground">Total histórico</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.successRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Emails enviados vs falhados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.todaySent || 0}</div>
            <p className="text-xs text-muted-foreground">Emails enviados hoje</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhas</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalFailed || 0}</div>
            <p className="text-xs text-muted-foreground">Total de falhas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros e Pesquisa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-2' : 'grid-cols-2 md:grid-cols-5'} gap-4`}>
            <div>
              <Input
                placeholder="Buscar por email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
              />
            </div>
            
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="failed">Falhados</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="automatic">Automático</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Último dia</SelectItem>
                <SelectItem value="7">Última semana</SelectItem>
                <SelectItem value="30">Último mês</SelectItem>
                <SelectItem value="90">Últimos 3 meses</SelectItem>
                <SelectItem value="all">Todo período</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleExportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Emails</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex justify-center p-4">Carregando logs...</div>
          ) : emailLogs && emailLogs.length > 0 ? (
            isMobile ? (
              <div className="space-y-2">
                {emailLogs.map((log) => (
                  <Card key={log.id} className="p-3">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{log.email}</span>
                        <Badge variant={
                          log.status === "sent" ? "default" :
                          log.status === "failed" ? "destructive" : "secondary"
                        } className="text-xs">
                          {log.status === "sent" ? "Enviado" : 
                           log.status === "failed" ? "Falhou" : "Pendente"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div><strong>Assunto:</strong> {log.subject}</div>
                        <div><strong>Data:</strong> {new Date(log.sent_at).toLocaleString("pt-BR")}</div>
                        <div><strong>Tipo:</strong> {log.is_manual ? "Manual" : "Automático"}</div>
                        {log.error_message && (
                          <div className="text-destructive"><strong>Erro:</strong> {log.error_message}</div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.sent_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>{log.email}</TableCell>
                      <TableCell className="max-w-xs truncate">{log.subject}</TableCell>
                      <TableCell>
                        <Badge variant={
                          log.status === "sent" ? "default" :
                          log.status === "failed" ? "destructive" : "secondary"
                        }>
                          {log.status === "sent" ? "Enviado" : 
                           log.status === "failed" ? "Falhou" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {log.is_manual ? "Manual" : "Automático"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-destructive">
                        {log.error_message || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum log de email encontrado com os filtros aplicados.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};