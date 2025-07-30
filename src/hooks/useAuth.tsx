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

      // First, clean up any orphaned profiles (profiles without valid auth users)
      console.log('🧹 Checking for orphaned profiles...');
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, user_id, institutional_user');

      if (allProfiles && allProfiles.length > 0) {
        // Check each profile to see if the corresponding auth user exists
        for (const profile of allProfiles) {
          const normalizedStored = profile.institutional_user
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          
          // If this profile matches the user we're trying to create
          if (normalizedStored === normalizedInput) {
            console.log(`🧹 Found existing profile for ${profile.institutional_user}, checking if auth user exists...`);
            
            // Always delete the existing profile first to avoid conflicts
            console.log(`🧹 Removing existing profile for ${profile.institutional_user} to allow recreation`);
            await supabase.from('profiles').delete().eq('id', profile.id);
            
            // Also try to delete any auth user that might exist
            try {
              const { data: authUsers } = await supabase.auth.admin.listUsers();
              if (authUsers?.users) {
                const existingAuthUser = authUsers.users.find((user: any) => 
                  user.email === `${profile.institutional_user}@temp.com`
                );
                if (existingAuthUser) {
                  console.log(`🧹 Removing existing auth user for ${profile.institutional_user}`);
                  await supabase.auth.admin.deleteUser(existingAuthUser.id);
                }
              }
            } catch (authCleanupError) {
              console.log(`⚠️ Could not cleanup auth user: ${authCleanupError.message}`);
            }
          }
        }
      }

      const bcrypt = await import('bcryptjs');
      const pinHash = await bcrypt.hash(pin, 10);

      // Create user with PIN as password
      const { data, error: authError } = await supabase.auth.signUp({
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

      if (authError) {
        console.error('Auth error:', authError);
        // Handle specific error cases
        if (authError.message.includes('User already registered') || 
            authError.message.includes('Email already registered')) {
          return { error: { message: 'Este usuário institucional já está cadastrado. Faça login em vez de cadastro.' } };
        }
        return { error: { message: `Erro na criação da conta: ${authError.message}` } };
      }

      // Check if signup was successful but user already exists
      if (!data.user) {
        return { error: { message: 'Erro inesperado durante o cadastro. Tente novamente.' } };
      }

      if (data.user) {
        try {
          // Confirm user automatically first to ensure user exists in auth.users
          await supabase.functions.invoke('confirm-user', {
            body: { userId: data.user.id }
          });
          console.log('✅ User auto-confirmed successfully');
          
          // Wait a bit for the confirmation to propagate
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Now create the profile after user is confirmed
          const { error: profileError } = await supabase.rpc('handle_signup_with_profile', {
            p_display_name: displayName,
            p_institutional_user: normalizedUser,
            p_pin_hash: pinHash,
            p_user_id: data.user.id
          });

          if (profileError) {
            console.error('Profile creation error:', profileError);
            
            // If profile creation fails, clean up the auth user
            try {
              await supabase.auth.admin.deleteUser(data.user.id);
            } catch (cleanupError) {
              console.error('Failed to cleanup auth user:', cleanupError);
            }
            
            return { error: { message: 'Erro ao criar perfil. Tente novamente.' } };
          }
          
          return { error: null };
        } catch (confirmError) {
          console.warn('Auto-confirm failed:', confirmError);
          
          // Clean up auth user if confirm fails
          try {
            await supabase.auth.admin.deleteUser(data.user.id);
          } catch (cleanupError) {
            console.error('Failed to cleanup auth user:', cleanupError);
          }
          
          return { error: { message: 'Erro na confirmação do usuário. Tente novamente.' } };
        }
      }

      return { error: { message: 'Erro inesperado durante o cadastro' } };
    } catch (error) {
      console.error('Signup error:', error);
      return { error: { message: 'Erro interno. Tente novamente.' } };
    }
  };

  const signIn = async (institutionalUser: string, pin: string) => {
    try {
      const bcrypt = await import('bcryptjs');

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

      // Check PIN
      const isValidPin = await bcrypt.compare(pin, profileData.pin_hash);
      if (!isValidPin) {
        return { error: { message: 'PIN incorreto' } };
      }

      // Sign in with PIN as password
      const tempEmail = `${profileData.institutional_user}@temp.com`;
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: tempEmail,
        password: pin
      });

      if (signInError) {
        // If error is about unconfirmed email, try to confirm and retry
        if (signInError.message?.includes('confirmation') || 
            signInError.message?.includes('confirmed') ||
            signInError.message?.includes('not confirmed')) {
          
          try {
            // Auto-confirm the user
            await supabase.functions.invoke('confirm-user', {
              body: { userId: profileData.user_id }
            });
            
            // Wait a moment for the confirmation to process
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try sign in again with same credentials
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email: tempEmail,
              password: pin
            });
            
            if (retryError) {
              return { error: { message: 'Erro de autenticação. Tente novamente.' } };
            }
          } catch (confirmError) {
            console.error('Auto-confirm failed:', confirmError);
            return { error: { message: 'Erro de autenticação. Tente novamente.' } };
          }
        } else {
          return { error: signInError };
        }
      }

      return { error: null };
    } catch (error) {
      return { error };
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

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      updateProfile
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