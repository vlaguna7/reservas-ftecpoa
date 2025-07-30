import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  institutional_user: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (displayName: string, institutionalUser: string, pin: string) => Promise<{ error: any }>;
  signIn: (institutionalUser: string, pin: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
  resetUserPin: (institutionalUser: string, newPin: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    let initialCheckDone = false;

    console.log('🔄 AuthProvider useEffect started');

    // Function to handle session updates
    const handleSession = (session: Session | null, source: string) => {
      if (!isMounted) return;
      
      console.log(`🔐 Session update from ${source}:`, {
        hasSession: !!session,
        userId: session?.user?.id,
        accessToken: session?.access_token ? 'present' : 'missing'
      });
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Use setTimeout to avoid blocking the auth state change
        setTimeout(() => {
          if (isMounted) {
            fetchProfile(session.user.id);
          }
        }, 0);
      } else {
        setProfile(null);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        console.log('🔐 Auth state change:', event, {
          hasSession: !!session,
          userId: session?.user?.id,
          initialCheckDone
        });
        
        handleSession(session, `onAuthStateChange-${event}`);
        
        // Only set loading false after initial check or if we have a definitive session state
        if (initialCheckDone || event === 'SIGNED_OUT' || session) {
          setLoading(false);
        }
      }
    );

    // Check for existing session - this is crucial for page refreshes
    const checkInitialSession = async () => {
      try {
        console.log('🔍 Checking initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          setLoading(false);
          return;
        }
        
        console.log('📋 Initial session result:', {
          hasSession: !!session,
          userId: session?.user?.id,
          accessToken: session?.access_token ? 'present' : 'missing'
        });
        
        handleSession(session, 'initial-check');
        initialCheckDone = true;
        
        // Always set loading to false after initial check
        setTimeout(() => {
          if (isMounted) {
            setLoading(false);
          }
        }, 100);
        
      } catch (error) {
        console.error('❌ Exception during initial session check:', error);
        setLoading(false);
      }
    };

    // Start initial session check
    checkInitialSession();

    return () => {
      console.log('🧹 AuthProvider cleanup');
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const signUp = async (displayName: string, institutionalUser: string, pin: string) => {
    try {
      // Normalize the institutional user (preserve original for storage)
      const normalizedUser = institutionalUser.trim();
      const normalizedInput = normalizedUser
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Remove accents

      // Use consistent domain for all users
      const tempEmail = `${normalizedUser}@temp.com`;

      console.log('🔄 Starting signup process for:', normalizedUser);

      // PHASE 1: Complete cleanup of any existing data
      console.log('🧹 Phase 1: Comprehensive cleanup...');
      
      // Find any existing profiles with this institutional_user
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('*');

      if (existingProfiles && existingProfiles.length > 0) {
        for (const profile of existingProfiles) {
          const normalizedStored = profile.institutional_user
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          
          // If this profile matches the user we're trying to create
          if (normalizedStored === normalizedInput) {
            console.log(`🧹 Found existing profile for ${profile.institutional_user}, removing completely...`);
            
            // Delete all reservations first
            await supabase
              .from('reservations')
              .delete()
              .eq('user_id', profile.user_id);
            
            // Delete the profile
            await supabase
              .from('profiles')
              .delete()
              .eq('id', profile.id);
            
            console.log(`🧹 Removed profile and reservations for ${profile.institutional_user}`);
          }
        }
      }

      // PHASE 2: Try to create new auth user (with retries)
      console.log('🔄 Phase 2: Creating auth user...');
      
      const bcrypt = await import('bcryptjs');
      const pinHash = await bcrypt.hash(pin, 10);

      let authResult = null;
      let authError = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        console.log(`🔄 Auth creation attempt ${retryCount + 1}/${maxRetries}`);
        
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

        if (!error && data.user) {
          authResult = data;
          authError = null;
          console.log('✅ Auth user created successfully');
          break;
        } else {
          authError = error;
          retryCount++;
          console.log(`❌ Auth creation attempt ${retryCount} failed:`, error?.message);
          
          if (retryCount < maxRetries) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          }
        }
      }

      if (authError || !authResult?.user) {
        console.error('❌ Final auth error:', authError);
        if (authError?.message.includes('User already registered') || 
            authError?.message.includes('Email already registered')) {
          return { error: { message: 'Este usuário institucional já está cadastrado. Faça login em vez de cadastro.' } };
        }
        return { error: { message: `Erro na criação da conta: ${authError?.message || 'Erro desconhecido'}` } };
      }

      // PHASE 3: Confirm user and create profile
      console.log('🔄 Phase 3: Confirming user and creating profile...');
      
      try {
        // Confirm user automatically
        const { error: confirmError } = await supabase.functions.invoke('confirm-user', {
          body: { userId: authResult.user.id }
        });
        
        if (confirmError) {
          console.warn('⚠️ Auto-confirm failed:', confirmError);
        } else {
          console.log('✅ User auto-confirmed successfully');
        }
        
        // Wait for confirmation to propagate
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Create the profile using RPC function
        const { error: profileError } = await supabase.rpc('handle_signup_with_profile', {
          p_display_name: displayName,
          p_institutional_user: normalizedUser,
          p_pin_hash: pinHash,
          p_user_id: authResult.user.id
        });

        if (profileError) {
          console.error('❌ Profile creation error:', profileError);
          
          // Cleanup auth user if profile creation fails
          try {
            await supabase.auth.admin.deleteUser(authResult.user.id);
          } catch (cleanupError) {
            console.error('Failed to cleanup auth user:', cleanupError);
          }
          
          return { error: { message: 'Erro ao criar perfil. Tente novamente.' } };
        }
        
        console.log('✅ Signup process completed successfully');
        return { error: null };
        
      } catch (confirmError) {
        console.error('❌ Confirm/Profile creation failed:', confirmError);
        
        // Cleanup auth user
        try {
          await supabase.auth.admin.deleteUser(authResult.user.id);
        } catch (cleanupError) {
          console.error('Failed to cleanup auth user:', cleanupError);
        }
        
        return { error: { message: 'Erro na confirmação do usuário. Tente novamente.' } };
      }

    } catch (error) {
      console.error('❌ Signup error:', error);
      return { error: { message: 'Erro interno. Tente novamente.' } };
    }
  };

  const signIn = async (institutionalUser: string, pin: string) => {
    try {
      // Normalize user input (remove accents, lowercase)
      const normalizedInput = institutionalUser.trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Remove accents

      // Search for user profile by trying multiple matching strategies
      // First try exact match with original input
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('institutional_user', institutionalUser.trim())
        .maybeSingle();

      // If not found, try with normalized search (no accents)
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

      // Validate PIN format (6 digits)
      if (!/^\d{6}$/.test(pin)) {
        return { error: { message: 'PIN deve ter exatamente 6 dígitos' } };
      }

      const tempEmail = `${profileData.institutional_user}@temp.com`;
      console.log('🔐 Attempting login with:', { 
        tempEmail, 
        pinLength: pin.length,
        institutionalUser: profileData.institutional_user,
        userCreatedAt: profileData.created_at
      });

      // Try different password formats for login
      const passwordFormats = [
        pin, // Current format (new users)
        `FTEC_${profileData.institutional_user}_${pin}_2024!`, // Legacy format (old users)
        `${profileData.institutional_user}_${pin}`, // Alternative format
      ];

      let signInError = null;
      let data = null;

      // Try each password format until one works
      for (const [index, password] of passwordFormats.entries()) {
        console.log(`🔐 Trying password format ${index + 1}/3`);
        
        const result = await supabase.auth.signInWithPassword({
          email: tempEmail,
          password: password
        });

        if (!result.error) {
          data = result.data;
          signInError = null;
          console.log(`🔐 Login successful with format ${index + 1}`);
          break;
        } else {
          signInError = result.error;
          console.log(`🔐 Format ${index + 1} failed:`, result.error.message);
        }
      }

      if (signInError) {
        // If error is about unconfirmed email, try to confirm and retry
        if (signInError.message?.includes('confirmation') || 
            signInError.message?.includes('confirmed') ||
            signInError.message?.includes('not confirmed')) {
          
          try {
            console.log('🔧 Auto-confirming user:', profileData.user_id);
            await supabase.functions.invoke('confirm-user', {
              body: { userId: profileData.user_id }
            });
            
            // Wait a moment for the confirmation to process
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Try the password formats again after confirmation
            for (const [index, password] of passwordFormats.entries()) {
              console.log(`🔧 Retry format ${index + 1}/3 after confirmation`);
              
              const result = await supabase.auth.signInWithPassword({
                email: tempEmail,
                password: password
              });

              if (!result.error) {
                console.log(`🔧 Retry successful with format ${index + 1}`);
                return { error: null };
              }
            }
            
            return { error: { message: 'Erro de autenticação após confirmação. Tente novamente.' } };
          } catch (confirmError) {
            console.error('Auto-confirm failed:', confirmError);
            return { error: { message: 'Erro de autenticação. Tente novamente.' } };
          }
        } else if (signInError.message?.includes('Invalid login credentials')) {
          return { error: { message: 'PIN incorreto ou usuário não encontrado' } };
        } else {
          return { error: { message: signInError.message } };
        }
      }

      return { error: null };
    } catch (error) {
      console.error('SignIn error:', error);
      return { error: { message: 'Erro interno. Tente novamente.' } };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    navigate('/auth');
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: { message: 'Usuário não autenticado' } };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) {
        return { error };
      }

      // Refresh profile
      await fetchProfile(user.id);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const resetUserPin = async (institutionalUser: string, newPin: string) => {
    try {
      const bcrypt = await import('bcryptjs');
      
      // Find the user profile first
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('institutional_user', institutionalUser.trim())
        .maybeSingle();

      if (profileError || !profileData) {
        return { error: { message: 'Usuário não encontrado' } };
      }

      // Generate new PIN hash
      const newPinHash = await bcrypt.hash(newPin, 10);

      // Update PIN hash in profiles table
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ pin_hash: newPinHash, updated_at: new Date().toISOString() })
        .eq('user_id', profileData.user_id);

      if (updateError) {
        return { error: { message: 'Erro ao atualizar PIN na base de dados' } };
      }

      // Update password in Auth system using the edge function
      try {
        const { error: authUpdateError } = await supabase.functions.invoke('update-user-password', {
          body: { userId: profileData.user_id, newPassword: newPin }
        });

        if (authUpdateError) {
          console.error('Error updating auth password:', authUpdateError);
          return { error: { message: 'Erro ao atualizar senha de autenticação' } };
        }

        console.log('✅ PIN reset successful for user:', institutionalUser);
        return { error: null };
      } catch (authError) {
        console.error('Auth update failed:', authError);
        return { error: { message: 'Erro ao atualizar sistema de autenticação' } };
      }
    } catch (error) {
      console.error('Reset PIN error:', error);
      return { error: { message: 'Erro interno. Tente novamente.' } };
    }
  };

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}