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
    let loadingTimeout: NodeJS.Timeout; // Timeout para iOS Safari

    // Detectar iOS Safari para logs específicos
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
    
    if (isIOSSafari) {
      console.log('🍎 iOS Safari detectado - aplicando correções específicas');
    }

    // TIMEOUT DE SEGURANÇA mais generoso para iOS Safari (15 segundos)
    loadingTimeout = setTimeout(() => {
      if (isMounted && loading) {
        console.log('⏰ Timeout de loading atingido - finalizando carregamento');
        setLoading(false);
        // Não forçar redirect imediato no iOS - dar chance para sessão se estabelecer
        if (isIOSSafari) {
          console.log('🍎 iOS Safari: Timeout atingido, mas mantendo usuário na página atual');
        }
      }
    }, 15000);

    // Limpar possíveis tokens inválidos no localStorage na inicialização
    const clearInvalidTokens = async () => {
      try {
        if (isIOSSafari) {
          console.log('🍎 iOS Safari: Verificando tokens...');
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error && error.message.includes('refresh_token_not_found')) {
          if (isIOSSafari) {
            console.log('🍎 iOS Safari: Token inválido encontrado, limpando...');
          }
          await supabase.auth.signOut();
          localStorage.clear();
          // Para iOS, também limpar sessionStorage
          if (isIOSSafari) {
            sessionStorage.clear();
          }
        }
      } catch (error) {
        if (isIOSSafari) {
          console.log('🍎 iOS Safari: Erro na verificação de tokens, limpando tudo...');
        }
        await supabase.auth.signOut();
        localStorage.clear();
        if (isIOSSafari) {
          sessionStorage.clear();
        }
      }
    };

    clearInvalidTokens();

    // ===== FUNÇÃO PARA TRATAR ATUALIZAÇÕES DE SESSÃO =====
    // Centraliza o tratamento de mudanças de sessão
    const handleSession = (session: Session | null, source: string) => {
      if (!isMounted) return; // Evita atualizações se componente foi desmontado
      
      if (isIOSSafari) {
        console.log(`🍎 iOS Safari: handleSession - source: ${source}, hasSession: ${!!session}`);
      }
      
      // Atualizar estados com dados da sessão
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Buscar perfil em background para não bloquear a UI
        // Para iOS Safari, usar delay maior para evitar problemas
        const delay = isIOSSafari ? 500 : 0;
        setTimeout(() => {
          if (isMounted) {
            fetchProfile(session.user.id);
          }
        }, delay);
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
        if (isIOSSafari) {
          console.log('🍎 iOS Safari: Iniciando verificação de sessão...');
        }
        
        // Para iOS Safari, tentar sessionStorage como fallback
        if (isIOSSafari) {
          const fallbackSession = sessionStorage.getItem('supabase.auth.token');
          if (fallbackSession) {
            console.log('🍎 iOS Safari: Sessão encontrada no sessionStorage');
          }
        }
        
        // Buscar sessão existente no Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          if (isIOSSafari) {
            console.log('🍎 iOS Safari: Erro na verificação de sessão:', error.message);
          }
          setLoading(false);
          return;
        }
        
        if (isIOSSafari) {
          console.log('🍎 iOS Safari: Sessão verificada:', !!session);
        }
        
        handleSession(session, 'verificacao-inicial');
        initialCheckDone = true;
        
        // Para iOS Safari, delay maior para garantir estabilidade
        const delay = isIOSSafari ? 300 : 100;
        setTimeout(() => {
          if (isMounted) {
            setLoading(false);
          }
        }, delay);
        
      } catch (error) {
        if (isIOSSafari) {
          console.log('🍎 iOS Safari: Erro fatal na verificação:', error);
        }
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
      if (loadingTimeout) {
        clearTimeout(loadingTimeout); // Limpar timeout
      }
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

  // ===== FUNÇÃO DE CADASTRO =====
  // Cria nova conta de usuário com perfil
  const signUp = async (displayName: string, institutionalUser: string, pin: string) => {
    try {
      const normalizedUser = institutionalUser.trim();
      const tempEmail = `${normalizedUser}@temp.com`; // Email temporário para Supabase

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
            display_name: displayName
          }
        }
      });

      if (error) {
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
        return { error: { message: 'Erro na criação do perfil' } };
      }

      return { error: null };

    } catch (error: any) {
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