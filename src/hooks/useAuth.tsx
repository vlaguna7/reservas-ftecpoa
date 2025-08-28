// ===== IMPORTAÇÕES DO REACT =====
// Hooks principais do React para contexto e estado
import { createContext, useContext, useEffect, useState } from 'react';

// ===== TIPOS DO SUPABASE =====
// Tipos para usuário e sessão do Supabase Auth
// 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS DE AUTH:
// - Firebase: import { User } from 'firebase/auth'
// - Auth0: import { User } from '@auth0/auth0-react'
// - AWS Cognito: import { CognitoUser } from 'amazon-cognito-identity-js'
// - NextAuth: import { Session, User } from 'next-auth'
import { User, Session } from '@supabase/supabase-js';

// ===== CLIENTE SUPABASE =====
// Cliente configurado para comunicação com o banco
// 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
// - Firebase: import { auth, db } from './firebase'
// - MongoDB: import { MongoClient } from 'mongodb'
// - MySQL: import mysql from 'mysql2/promise'
// - PostgreSQL: import { Pool } from 'pg'
import { supabase } from '@/integrations/supabase/client';

// ===== HOOKS DE NAVEGAÇÃO E NOTIFICAÇÃO =====
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

// ===== INTERFACE DO PERFIL DO USUÁRIO =====
// Define a estrutura dos dados do perfil armazenados no banco
// 📝 Esta interface corresponde à tabela 'profiles' no banco de dados
// 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
// - MongoDB: pode ser um documento flexível sem schema rígido
// - MySQL/PostgreSQL: corresponde às colunas da tabela
// - Firebase: documento no Firestore com estes campos
interface Profile {
  id: string;                    // ID único do perfil
  user_id: string;              // Referência ao usuário na tabela auth
  display_name: string;         // Nome de exibição do usuário
  institutional_user: string;   // Usuário institucional (matrícula/login)
  is_admin: boolean;            // Flag de administrador
  status: 'pending' | 'approved' | 'rejected'; // Status de aprovação
  approved_by?: string;         // ID do admin que aprovou
  approved_at?: string;         // Data de aprovação
  rejection_reason?: string;    // Motivo da rejeição (se rejeitado)
  created_at: string;           // Data de criação
  updated_at: string;           // Data de última atualização
}

// ===== INTERFACE DO CONTEXTO DE AUTENTICAÇÃO =====
// Define todos os métodos e propriedades disponíveis no contexto
// Este é o "contrato" que os componentes podem usar
interface AuthContextType {
  // ===== PROPRIEDADES DE ESTADO =====
  user: User | null;              // Usuário atual do Supabase Auth
  session: Session | null;        // Sessão atual (inclui tokens)
  profile: Profile | null;        // Perfil completo do usuário
  loading: boolean;               // Estado de carregamento

  // ===== MÉTODOS DE AUTENTICAÇÃO =====
  // Função para criar nova conta
  signUp: (displayName: string, institutionalUser: string, pin: string) => Promise<{ error: any }>;
  // Função para fazer login
  signIn: (institutionalUser: string, pin: string) => Promise<{ error: any }>;
  // Função para logout
  signOut: () => Promise<void>;
  // Função para atualizar perfil
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  // Função para resetar PIN do usuário
  resetUserPin: (institutionalUser: string, newPin: string) => Promise<{ error: any }>;
}

// ===== CRIAÇÃO DO CONTEXTO =====
// Context API do React para compartilhar estado de auth entre componentes
// 🔄 ALTERNATIVAS: Redux, Zustand, Jotai, Valtio
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===== PROVIDER DE AUTENTICAÇÃO =====
// Componente que envolve a aplicação e fornece o contexto de auth
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ===== ESTADOS LOCAIS =====
  const [user, setUser] = useState<User | null>(null);           // Usuário do Supabase Auth
  const [session, setSession] = useState<Session | null>(null);   // Sessão atual
  const [profile, setProfile] = useState<Profile | null>(null);   // Perfil do usuário
  const [loading, setLoading] = useState(true);                   // Estado de carregamento
  const navigate = useNavigate();                                 // Hook de navegação

  // ===== EFEITO PRINCIPAL - MONITORAMENTO DE SESSÃO =====
  // Este useEffect é executado uma vez quando o componente monta
  // e configura os listeners para mudanças de autenticação
  useEffect(() => {
    let isMounted = true;        // Flag para evitar atualizações após unmount
    let initialCheckDone = false; // Flag para controlar verificação inicial

    // Limpar possíveis tokens inválidos no localStorage na inicialização
    const clearInvalidTokens = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error && error.message.includes('refresh_token_not_found')) {
          await supabase.auth.signOut();
          localStorage.clear();
        }
      } catch (error) {
        await supabase.auth.signOut();
        localStorage.clear();
      }
    };

    clearInvalidTokens();

    // ===== FUNÇÃO PARA TRATAR ATUALIZAÇÕES DE SESSÃO =====
    // Centraliza o tratamento de mudanças de sessão
    const handleSession = (session: Session | null, source: string) => {
      if (!isMounted) return; // Evita atualizações se componente foi desmontado
      
      // Atualizar estados com dados da sessão
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Buscar perfil em background para não bloquear a UI
        // 🔄 ALTERNATIVA: usar React Query para cache automático
        setTimeout(() => {
          if (isMounted) {
            fetchProfile(session.user.id);
          }
        }, 0);
      } else {
        setProfile(null); // Limpar perfil se não há sessão
      }
    };

    // ===== CONFIGURAR LISTENER DE MUDANÇAS DE AUTH =====
    // O Supabase Auth notifica sobre login, logout, refresh de token, etc.
    // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
    // - Firebase: onAuthStateChanged(auth, callback)
    // - Auth0: useUser() hook
    // - AWS Cognito: Hub.listen('auth', callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        
        
        handleSession(session, `onAuthStateChange-${event}`);
        
        // Só remove loading após verificação inicial ou estado definitivo
        if (initialCheckDone || event === 'SIGNED_OUT' || session) {
          setLoading(false);
        }
      }
    );

    // ===== VERIFICAÇÃO INICIAL DE SESSÃO =====
    // Crucial para page refreshes - verifica se já existe sessão ativa
    // Sem isso, usuários logados seriam redirecionados para login ao recarregar
    const checkInitialSession = async () => {
      try {
        
        
        // Buscar sessão existente no Supabase
        // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
        // - Firebase: getCurrentUser() ou auth.currentUser
        // - Auth0: getAccessTokenSilently()
        // - localStorage: localStorage.getItem('token')
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setLoading(false);
          return;
        }
        
        handleSession(session, 'verificacao-inicial');
        initialCheckDone = true;
        
        // Sempre remover loading após verificação inicial
        setTimeout(() => {
          if (isMounted) {
            setLoading(false);
          }
        }, 100);
        
      } catch (error) {
        setLoading(false);
      }
    };

    // Iniciar verificação da sessão inicial
    checkInitialSession();

    // ===== CLEANUP =====
    // Função executada quando componente é desmontado
    return () => {
      isMounted = false;
      subscription.unsubscribe(); // Remover listener
    };
  }, []);

  // ===== FUNÇÃO PARA BUSCAR PERFIL DO USUÁRIO =====
  // Busca dados adicionais do usuário na tabela profiles
  // 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
  // - MongoDB: db.profiles.findOne({user_id: userId})
  // - MySQL: SELECT * FROM profiles WHERE user_id = ?
  // - Firebase: doc(db, 'profiles', userId).get()
  const fetchProfile = async (userId: string) => {
    try {
      // 1) Verifica status via função SECURITY DEFINER (bypassa RLS)
      const { data: statusData, error: statusError } = await supabase.rpc('get_user_status', {
        p_user_id: userId,
      });

      const status = (statusData as string | null) ?? null;

      // Se não conseguimos verificar o status com segurança, bloquear por padrão
      if (statusError || !status) {
        await supabase.auth.signOut();
        toast({
          title: 'Não foi possível verificar seu status',
          description: 'Tente novamente mais tarde ou contate o administrador.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      if (status === 'pending') {
        await supabase.auth.signOut();
        toast({
          title: 'Cadastro Pendente',
          description:
            'Seu cadastro está aguardando aprovação do administrador. Entre em contato para mais informações.',
          variant: 'default',
        });
        navigate('/auth');
        return;
      }

      if (status === 'rejected') {
        await supabase.auth.signOut();
        toast({
          title: 'Cadastro Rejeitado',
          description: 'Seu cadastro foi rejeitado. Entre em contato com o administrador.',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      // 2) Status aprovado: carregar perfil (RLS permitirá SELECT)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
      }
    } catch (error) {
      // Silently handle profile fetch errors
    }
  };

  // ===== FUNÇÃO DE CADASTRO COM PROTEÇÃO ANTI-IP =====
  // Cria nova conta de usuário com validação avançada de IP e perfil
  const signUp = async (displayName: string, institutionalUser: string, pin: string) => {
    try {
      const normalizedUser = institutionalUser.trim();
      const tempEmail = `${normalizedUser}@temp.com`; // Email temporário para Supabase

      // ===== VALIDAÇÃO PRÉ-REGISTRO =====
      // Verificar IP e limite de registros antes de criar usuário
      const { data: validationResult, error: validationError } = await supabase.functions.invoke('validate-registration', {
        body: {
          institutional_user: normalizedUser,
          display_name: displayName,
          pin: pin,
          user_agent: navigator.userAgent
        }
      });

      if (validationError) {
        console.error('Validation error:', validationError);
        return { error: { message: 'Erro na validação do registro. Tente novamente.' } };
      }

      if (!validationResult?.success) {
        return { error: { message: validationResult?.message || 'Erro na validação' } };
      }

      if (!validationResult.canRegister) {
        let errorMessage = 'Não foi possível realizar o cadastro.';
        
        if (validationResult.reason === 'ip_blocked') {
          errorMessage = 'IP temporariamente bloqueado devido a múltiplas tentativas. Tente novamente mais tarde.';
        } else if (validationResult.reason === 'limit_exceeded') {
          errorMessage = 'Limite de cadastros por IP atingido (máximo 3). Entre em contato com o administrador se necessário.';
        } else {
          errorMessage = validationResult.message || errorMessage;
        }

        return { error: { message: errorMessage } };
      }

      // ===== LIMPEZA DE PERFIL EXISTENTE =====
      // Verifica se já existe um perfil com este usuário institucional
      // e remove para evitar conflitos
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id, id')
        .eq('institutional_user', normalizedUser)
        .single();

      if (existingProfile) {
        // Remover reservas e perfil antigos
        await supabase.from('reservations').delete().eq('user_id', existingProfile.user_id);
        await supabase.from('profiles').delete().eq('id', existingProfile.id);
      }

      // ===== CRIAÇÃO DE USUÁRIO =====
      // Importar bcrypt dinamicamente para hash do PIN
      // 🔄 ALTERNATIVAS DE HASH: argon2, scrypt, PBKDF2
      const bcrypt = await import('bcryptjs');
      const pinHash = await bcrypt.hash(pin, 10); // Salt rounds = 10

      // Criar usuário no Supabase Auth
      // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
      // - Firebase: createUserWithEmailAndPassword(auth, email, password)
      // - Auth0: auth0.signup({email, password, connection})
      // - AWS Cognito: cognito.signUp({username, password})
      const { data, error } = await supabase.auth.signUp({
        email: tempEmail,
        password: pin,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            institutional_user: normalizedUser,
            display_name: displayName,
            user_agent: navigator.userAgent,
            ip_address: 'client_captured' // Será capturado pela Edge Function
          }
        }
      });

      if (error) {
        // Log tentativa falhada
        await supabase.rpc('log_registration_attempt', {
          p_ip_address: '127.0.0.1', // Fallback, real IP será capturado no servidor
          p_user_agent: navigator.userAgent,
          p_success: false,
          p_user_id: null
        });

        if (error.message.includes('already registered')) {
          return { error: { message: 'Usuário já existe. Tente fazer login.' } };
        }
        return { error: { message: `Erro na criação: ${error.message}` } };
      }

      if (!data.user) {
        return { error: { message: 'Erro na criação da conta' } };
      }

      // ===== CONFIRMAÇÃO E CRIAÇÃO DE PERFIL EM PARALELO =====
      // Executa confirmação automática e criação de perfil simultaneamente
      const [confirmResult, profileResult] = await Promise.allSettled([
        // Confirmar usuário automaticamente via Edge Function
        supabase.functions.invoke('confirm-user', {
          body: { userId: data.user.id }
        }),
        // Criar perfil via função do banco
        supabase.rpc('handle_signup_with_profile', {
          p_display_name: displayName,
          p_institutional_user: normalizedUser,
          p_pin_hash: pinHash,
          p_user_id: data.user.id
        })
      ]);

      // Verificar se criação do perfil foi bem-sucedida
      if (profileResult.status === 'rejected' || (profileResult.status === 'fulfilled' && profileResult.value.error)) {
        // Reverter criação do usuário se perfil falhou
        await supabase.auth.admin.deleteUser(data.user.id);
        
        // Log tentativa falhada
        await supabase.rpc('log_registration_attempt', {
          p_ip_address: '127.0.0.1',
          p_user_agent: navigator.userAgent,
          p_success: false,
          p_user_id: data.user.id
        });

        return { error: { message: 'Erro na criação do perfil' } };
      }

      // ===== LOG DE SUCESSO =====
      // Registrar cadastro bem-sucedido
      await supabase.rpc('log_registration_attempt', {
        p_ip_address: '127.0.0.1', // Real IP será capturado no servidor
        p_user_agent: navigator.userAgent,
        p_success: true,
        p_user_id: data.user.id
      });

      return { error: null };

    } catch (error: any) {
      // Log erro interno
      await supabase.rpc('log_registration_attempt', {
        p_ip_address: '127.0.0.1',
        p_user_agent: navigator.userAgent || 'unknown',
        p_success: false,
        p_user_id: null
      });

      return { error: { message: `Erro interno: ${error.message}` } };
    }
  };

  // ===== FUNÇÃO DE LOGIN =====
  // Autentica usuário com usuário institucional e PIN
  const signIn = async (institutionalUser: string, pin: string) => {
    try {
      // ===== VALIDAÇÃO DO PIN =====
      if (!/^\d{6}$/.test(pin)) {
        return { error: { message: 'PIN deve ter exatamente 6 dígitos' } };
      }

      // ===== NORMALIZAÇÃO DO INPUT =====
      const normalizedInput = institutionalUser.trim();

      // ===== CONSTRUÇÃO DE EMAILS CANDIDATOS =====
      // Tenta diferentes variações para compatibilidade com usuários antigos
      const candidateEmails = [
        `${normalizedInput}@temp.com`,
        `${normalizedInput.toLowerCase()}@temp.com`
      ];

      // ===== FORMATOS DE SENHA PARA COMPATIBILIDADE =====
      const passwordFormats = [
        pin, // Formato atual
        `${normalizedInput}_${pin}_2024!`, // Formato legado
        `${normalizedInput}_${pin}`, // Formato alternativo
        `${normalizedInput.toLowerCase()}_${pin}_2024!`, // Formato legado lowercase
        `${normalizedInput.toLowerCase()}_${pin}` // Formato alternativo lowercase
      ];

      let signInError = null;
      let loginSuccessful = false;
      let userIdFromLogin = null;

      // ===== TENTATIVAS DE LOGIN =====
      // Tenta todas as combinações de email e senha
      outerLoop: for (const email of candidateEmails) {
        for (const password of passwordFormats) {
          const result = await supabase.auth.signInWithPassword({
            email: email,
            password: password
          });

          if (!result.error) {
            loginSuccessful = true;
            userIdFromLogin = result.data.user?.id;
            break outerLoop;
          } else {
            signInError = result.error;
            
            // Se erro de confirmação de email, tentar confirmar automaticamente
            if (result.error.message?.includes('confirmation') || 
                result.error.message?.includes('confirmed') ||
                result.error.message?.includes('not confirmed')) {
              
              try {
                // Buscar user_id pelo institutional_user para confirmar
                const candidateUsernames = [normalizedInput, normalizedInput.toLowerCase()];
                let profileForConfirm = null;
                
                for (const username of candidateUsernames) {
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('user_id')
                    .eq('institutional_user', username)
                    .single();
                  
                  if (profileData?.user_id) {
                    profileForConfirm = profileData;
                    break;
                  }
                }

                if (profileForConfirm?.user_id) {
                  await supabase.functions.invoke('confirm-user', {
                    body: { userId: profileForConfirm.user_id }
                  });
                  
                  await new Promise(resolve => setTimeout(resolve, 1500));
                  
                  // Tentar novamente após confirmação
                  const retryResult = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                  });

                  if (!retryResult.error) {
                    loginSuccessful = true;
                    userIdFromLogin = retryResult.data.user?.id;
                    break outerLoop;
                  }
                }
              } catch (confirmError) {
                // Continue tentando outras combinações
              }
            }
          }
        }
      }

      // ===== VERIFICAR RESULTADO DO LOGIN =====
      if (!loginSuccessful) {
        if (signInError?.message?.includes('Invalid login credentials')) {
          return { error: { message: 'Usuário ou PIN incorretos. Verifique seus dados e tente novamente.' } };
        } else {
          return { error: { message: 'Usuário não encontrado ou não aprovado no sistema' } };
        }
      }

      // ===== VERIFICAR STATUS DE APROVAÇÃO APÓS LOGIN =====
      if (userIdFromLogin) {
        const { data: statusData, error: statusError } = await supabase.rpc('get_user_status', {
          p_user_id: userIdFromLogin,
        });
        
        const status = (statusData as string | null) ?? null;
        
        if (statusError || status !== 'approved') {
          await supabase.auth.signOut();
          const message = status === 'rejected'
            ? 'Cadastro rejeitado. Contate o administrador.'
            : status === 'pending'
            ? 'Cadastro pendente de aprovação. Aguarde o administrador.'
            : 'Não foi possível verificar status de aprovação.';
          return { error: { message } };
        }
      }

      return { error: null };
    } catch (error) {
      return { error: { message: 'Erro interno. Tente novamente.' } };
    }
  };

  // ===== FUNÇÃO DE LOGOUT =====
  // Remove sessão e redireciona para autenticação
  const signOut = async () => {
    // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
    // - Firebase: signOut(auth)
    // - Auth0: logout()
    // - AWS Cognito: cognito.signOut()
    // - JWT: localStorage.removeItem('token')
    await supabase.auth.signOut();
    setProfile(null); // Limpar perfil local
    navigate('/auth'); // Redirecionar para página de auth
  };

  // ===== FUNÇÃO DE ATUALIZAÇÃO DE PERFIL =====
  // Atualiza dados do perfil do usuário
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: { message: 'Usuário não autenticado' } };

    try {
      // 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
      // - MongoDB: db.profiles.updateOne({user_id}, {$set: updates})
      // - MySQL: UPDATE profiles SET ... WHERE user_id = ?
      // - Firebase: doc(db, 'profiles', userId).update(updates)
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        return { error };
      }

      // Atualizar perfil local
      await fetchProfile(user.id);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  // ===== FUNÇÃO DE RESET DE PIN =====
  // Permite administradores resetarem PIN de usuários
  const resetUserPin = async (institutionalUser: string, newPin: string) => {
    try {
      // Importar bcrypt para hash do novo PIN
      const bcrypt = await import('bcryptjs');
      
      // ===== BUSCAR PERFIL DO USUÁRIO =====
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('institutional_user', institutionalUser.trim())
        .maybeSingle();

      if (profileError || !profileData) {
        return { error: { message: 'Usuário não encontrado' } };
      }

      // ===== GERAR NOVO HASH DO PIN =====
      const newPinHash = await bcrypt.hash(newPin, 10);

      // ===== ATUALIZAR HASH NA TABELA PROFILES =====
      // 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
      // - MongoDB: db.profiles.updateOne({user_id}, {$set: {pin_hash}})
      // - MySQL: UPDATE profiles SET pin_hash = ?, updated_at = NOW() WHERE user_id = ?
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ pin_hash: newPinHash, updated_at: new Date().toISOString() })
        .eq('user_id', profileData.user_id);

      if (updateError) {
        return { error: { message: 'Erro ao atualizar PIN na base de dados' } };
      }

      // ===== ATUALIZAR SENHA NO SISTEMA DE AUTH =====
      // Usar Edge Function para atualizar senha no Supabase Auth
      // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
      // - Firebase: updatePassword(user, newPassword)
      // - Auth0: management.updateUser(userId, {password})
      // - AWS Cognito: cognito.adminSetUserPassword()
      try {
        const { error: authUpdateError } = await supabase.functions.invoke('update-user-password', {
          body: { userId: profileData.user_id, newPassword: newPin }
        });

        if (authUpdateError) {
          console.error('Erro ao atualizar senha de auth:', authUpdateError);
          return { error: { message: 'Erro ao atualizar senha de autenticação' } };
        }

        console.log('✅ Reset de PIN bem-sucedido para usuário:', institutionalUser);
        return { error: null };
      } catch (authError) {
        console.error('Atualização de auth falhou:', authError);
        return { error: { message: 'Erro ao atualizar sistema de autenticação' } };
      }
    } catch (error) {
      console.error('Erro no Reset PIN:', error);
      return { error: { message: 'Erro interno. Tente novamente.' } };
    }
  };

  // ===== RETORNO DO PROVIDER =====
  // Fornece todos os valores e funções para componentes filhos
  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      updateProfile,
      resetUserPin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ===== HOOK CUSTOMIZADO PARA USAR O CONTEXTO =====
// Simplifica o uso do contexto de auth em componentes
// 🔄 ALTERNATIVAS: usar useContext(AuthContext) diretamente
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}