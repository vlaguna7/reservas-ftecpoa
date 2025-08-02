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

    console.log('🔄 AuthProvider useEffect iniciado');

    // ===== FUNÇÃO PARA TRATAR ATUALIZAÇÕES DE SESSÃO =====
    // Centraliza o tratamento de mudanças de sessão
    const handleSession = (session: Session | null, source: string) => {
      if (!isMounted) return; // Evita atualizações se componente foi desmontado
      
      console.log(`🔐 Atualização de sessão de ${source}:`, {
        hasSession: !!session,
        userId: session?.user?.id,
        accessToken: session?.access_token ? 'presente' : 'ausente'
      });
      
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
        
        console.log('🔐 Mudança de estado de auth:', event, {
          hasSession: !!session,
          userId: session?.user?.id,
          initialCheckDone
        });
        
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
        console.log('🔍 Verificando sessão inicial...');
        
        // Buscar sessão existente no Supabase
        // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
        // - Firebase: getCurrentUser() ou auth.currentUser
        // - Auth0: getAccessTokenSilently()
        // - localStorage: localStorage.getItem('token')
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Erro ao obter sessão:', error);
          setLoading(false);
          return;
        }
        
        console.log('📋 Resultado da sessão inicial:', {
          hasSession: !!session,
          userId: session?.user?.id,
          accessToken: session?.access_token ? 'presente' : 'ausente'
        });
        
        handleSession(session, 'verificacao-inicial');
        initialCheckDone = true;
        
        // Sempre remover loading após verificação inicial
        setTimeout(() => {
          if (isMounted) {
            setLoading(false);
          }
        }, 100);
        
      } catch (error) {
        console.error('❌ Exceção durante verificação inicial:', error);
        setLoading(false);
      }
    };

    // Iniciar verificação da sessão inicial
    checkInitialSession();

    // ===== CLEANUP =====
    // Função executada quando componente é desmontado
    return () => {
      console.log('🧹 Limpeza do AuthProvider');
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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle() em vez de single() para evitar erro se não encontrar

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        return;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
    }
  };

  // ===== FUNÇÃO DE CADASTRO =====
  // Cria nova conta de usuário com perfil
  const signUp = async (displayName: string, institutionalUser: string, pin: string) => {
    try {
      const normalizedUser = institutionalUser.trim();
      const tempEmail = `${normalizedUser}@temp.com`; // Email temporário para Supabase
      
      console.log('🔄 Iniciando cadastro para:', normalizedUser);

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
        console.log('🗑️ Perfil existente removido');
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
        console.error('❌ Erro no cadastro:', error);
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
        console.error('❌ Falha na criação do perfil');
        // Reverter criação do usuário se perfil falhou
        await supabase.auth.admin.deleteUser(data.user.id);
        return { error: { message: 'Erro na criação do perfil' } };
      }

      console.log('✅ Cadastro concluído com sucesso');
      return { error: null };

    } catch (error: any) {
      console.error('❌ Exceção no cadastro:', error);
      return { error: { message: `Erro interno: ${error.message}` } };
    }
  };

  // ===== FUNÇÃO DE LOGIN =====
  // Autentica usuário com usuário institucional e PIN
  const signIn = async (institutionalUser: string, pin: string) => {
    try {
      // ===== NORMALIZAÇÃO DO INPUT =====
      // Remove acentos e padroniza entrada para busca flexível
      const normalizedInput = institutionalUser.trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Remove acentos

      // ===== BUSCA DO USUÁRIO =====
      // Primeiro tenta busca exata, depois busca normalizada
      // 🔄 ADAPTAÇÃO PARA OUTROS BANCOS:
      // - MongoDB: db.profiles.findOne({institutional_user: {$regex: /^user$/i}})
      // - MySQL: SELECT * FROM profiles WHERE LOWER(institutional_user) = LOWER(?)
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('institutional_user', institutionalUser.trim())
        .maybeSingle();

      // Se não encontrou, tenta busca normalizada (sem acentos)
      if (!profileData) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*');
        
        if (profiles) {
          profileData = profiles.find(profile => {
            const normalizedStored = profile.institutional_user
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
            return normalizedStored === normalizedInput;
          });
        }
      }

      if (profileError || !profileData) {
        return { error: { message: 'Usuário não encontrado' } };
      }

      // ===== VALIDAÇÃO DO PIN =====
      // PIN deve ter exatamente 6 dígitos
      if (!/^\d{6}$/.test(pin)) {
        return { error: { message: 'PIN deve ter exatamente 6 dígitos' } };
      }

      const tempEmail = `${profileData.institutional_user}@temp.com`;
      console.log('🔐 Tentativa de login com:', { 
        tempEmail, 
        pinLength: pin.length,
        institutionalUser: profileData.institutional_user,
        userCreatedAt: profileData.created_at
      });

      // ===== TENTATIVA DE LOGIN COM MÚLTIPLOS FORMATOS =====
      // Suporta diferentes formatos de senha para compatibilidade
      const passwordFormats = [
        pin, // Formato atual (usuários novos)
        `FTEC_${profileData.institutional_user}_${pin}_2024!`, // Formato legado
        `${profileData.institutional_user}_${pin}`, // Formato alternativo
      ];

      let signInError = null;
      let data = null;

      // Tenta cada formato até um funcionar
      for (const [index, password] of passwordFormats.entries()) {
        console.log(`🔐 Tentando formato de senha ${index + 1}/3`);
        
        // 🔄 ADAPTAÇÃO PARA OUTROS SISTEMAS:
        // - Firebase: signInWithEmailAndPassword(auth, email, password)
        // - Auth0: auth0.loginWithUsernamePassword({username, password})
        // - AWS Cognito: cognito.initiateAuth({username, password})
        const result = await supabase.auth.signInWithPassword({
          email: tempEmail,
          password: password
        });

        if (!result.error) {
          data = result.data;
          signInError = null;
          console.log(`🔐 Login bem-sucedido com formato ${index + 1}`);
          break;
        } else {
          signInError = result.error;
          console.log(`🔐 Formato ${index + 1} falhou:`, result.error.message);
        }
      }

      // ===== TRATAMENTO DE ERROS =====
      if (signInError) {
        // Erro de email não confirmado - tentar confirmar automaticamente
        if (signInError.message?.includes('confirmation') || 
            signInError.message?.includes('confirmed') ||
            signInError.message?.includes('not confirmed')) {
          
          try {
            console.log('🔧 Auto-confirmando usuário:', profileData.user_id);
            await supabase.functions.invoke('confirm-user', {
              body: { userId: profileData.user_id }
            });
            
            // Aguardar processamento da confirmação
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Tentar formatos novamente após confirmação
            for (const [index, password] of passwordFormats.entries()) {
              console.log(`🔧 Retry formato ${index + 1}/3 após confirmação`);
              
              const result = await supabase.auth.signInWithPassword({
                email: tempEmail,
                password: password
              });

              if (!result.error) {
                console.log(`🔧 Retry bem-sucedido com formato ${index + 1}`);
                // Aguardar atualização do estado de auth
                await new Promise(resolve => setTimeout(resolve, 200));
                return { error: null };
              }
            }
            
            return { error: { message: 'Erro de autenticação após confirmação. Tente novamente.' } };
          } catch (confirmError) {
            console.error('Auto-confirmação falhou:', confirmError);
            return { error: { message: 'Erro de autenticação. Tente novamente.' } };
          }
        } else if (signInError.message?.includes('Invalid login credentials')) {
          return { error: { message: 'PIN incorreto ou usuário não encontrado' } };
        } else {
          return { error: { message: signInError.message } };
        }
      }

      // Aguardar atualização do estado de auth antes de retornar
      await new Promise(resolve => setTimeout(resolve, 200));
      return { error: null };
    } catch (error) {
      console.error('Erro no SignIn:', error);
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