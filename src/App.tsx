// ===== IMPORTAÇÕES DE COMPONENTES DE UI =====
// Componentes para notificações toast do shadcn/ui
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
// Componente para tooltips
import { TooltipProvider } from "@/components/ui/tooltip";

// ===== BIBLIOTECAS DE TERCEIROS =====
// React Query para gerenciamento de estado e cache de dados
// 🔄 ALTERNATIVAS: SWR, Apollo Client (GraphQL), Zustand, Redux Toolkit Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// React Router para navegação entre páginas
// 🔄 ALTERNATIVAS: Next.js Router, Reach Router (descontinuado), Vue Router, Angular Router
import { BrowserRouter, Routes, Route } from "react-router-dom";

// ===== REACT HOOKS =====
import { useEffect } from "react";

// ===== HOOKS E PROVIDERS CUSTOMIZADOS =====
// Context Provider para autenticação de usuários
import { AuthProvider } from "@/hooks/useAuth";

// ===== SISTEMA DE SEGURANÇA =====
// Proteção contra ferramentas de desenvolvedor
import { devToolsProtection } from "@/lib/devToolsProtection";

// ===== PÁGINAS DA APLICAÇÃO =====
// Página inicial (landing page)
import Index from "./pages/Index";
// Página de autenticação (login/cadastro)
import Auth from "./pages/Auth";
// Dashboard principal do sistema (área logada)
import Dashboard from "./pages/Dashboard";
// Página 404 (não encontrada)
import NotFound from "./pages/NotFound";

// ===== CONFIGURAÇÃO DO REACT QUERY =====
// Cliente para gerenciamento de cache e estado de dados
// 🔄 CONFIGURAÇÕES ÚTEIS PARA OUTROS PROJETOS:
// - staleTime: tempo que dados ficam "frescos"
// - cacheTime: tempo que dados ficam em cache
// - retry: número de tentativas em caso de erro
// - refetchOnWindowFocus: buscar dados ao focar na janela
const queryClient = new QueryClient();

// ===== COMPONENTE PRINCIPAL DA APLICAÇÃO =====
// Este é o componente raiz que envolve toda a aplicação
// Estrutura hierárquica dos providers:
// 1. QueryClientProvider: gerenciamento de estado global
// 2. TooltipProvider: contexto para tooltips
// 3. Toasters: componentes de notificação
// 4. BrowserRouter: roteamento da aplicação
// 5. AuthProvider: contexto de autenticação
const App = () => {
  // Inicializar sistema de proteção contra DevTools
  useEffect(() => {
    devToolsProtection.init();
    
    // Cleanup na desmontagem do componente
    return () => {
      devToolsProtection.destroy();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Provider para tooltips em toda aplicação */}
      <TooltipProvider>
        {/* Componentes de notificação toast */}
        <Toaster />
        <Sonner />
        
        {/* Roteador principal da aplicação */}
        {/* 🔄 ALTERNATIVAS DE ROTEAMENTO:
            - HashRouter: para hospedam que não suportam HTML5 history
            - MemoryRouter: para testes ou apps que não precisam de URL
            - StaticRouter: para renderização no servidor (SSR) */}
        <BrowserRouter>
          {/* Provider de autenticação - envolve todas as rotas */}
          <AuthProvider>
            {/* Definição das rotas da aplicação */}
            <Routes>
              {/* Rota principal - página inicial */}
              <Route path="/" element={<Index />} />
              
              {/* Rota de autenticação - login e cadastro */}
              <Route path="/auth" element={<Auth />} />
              
              {/* Rota do dashboard - área logada */}
              <Route path="/dashboard" element={<Dashboard />} />
              
              {/* IMPORTANTE: Adicione todas as rotas customizadas ACIMA da rota "*" */}
              {/* Rota catch-all - captura qualquer URL não definida */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
