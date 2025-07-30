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

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        console.log('🔐 Auth state change:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch profile for all events where we have a user
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            // Use setTimeout to avoid deadlock with async operations
            setTimeout(() => {
              fetchProfile(session.user.id);
            }, 0);
          }
        } else {
          setProfile(null);
        }
        
        // Set loading to false after processing
        setLoading(false);
      }
    );

    // THEN check for existing session - this handles page refreshes
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      console.log('🔐 Initial session check:', session?.user?.id);
      
      // Only update state if this is different from what onAuthStateChange already set
      if (session !== null) {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchProfile(session.user.id).finally(() => {
            if (isMounted) setLoading(false);
          });
        } else {
          setLoading(false);
        }
      } else {
        // No session found, clear everything
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    }).catch(() => {
      // In case of error, stop loading
      setLoading(false);
    });

    return () => {
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

      // Check if user already exists using normalized comparison
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('institutional_user');

      if (allProfiles) {
        const existingUser = allProfiles.find(profile => {
          const normalizedStored = profile.institutional_user
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          return normalizedStored === normalizedInput;
        });
        
        if (existingUser) {
          return { error: { message: 'Usuário institucional já cadastrado' } };
        }
      }

      const bcrypt = await import('bcryptjs');
      const pinHash = await bcrypt.hash(pin, 10);

      // Create user with temporary email - normalize for valid email format
      const safeEmailUser = normalizedUser
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9.]/g, ''); // Keep only letters, numbers, and dots
      const tempEmail = `${safeEmailUser}@temp.com`;
      const { data, error: authError } = await supabase.auth.signUp({
        email: tempEmail,
        password: normalizedUser + pin,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            institutional_user: normalizedUser,
            display_name: displayName
          }
        }
      });

      if (authError) {
        return { error: authError };
      }

      if (data.user) {
        try {
          // Use the database function to create profile
          const { error: profileError } = await supabase.rpc('handle_signup_with_profile', {
            p_display_name: displayName,
            p_institutional_user: normalizedUser,
            p_pin_hash: pinHash,
            p_user_id: data.user.id
          });

          if (profileError) {
            console.error('Profile creation error:', profileError);
            return { error: { message: 'Erro ao criar perfil. Tente novamente.' } };
          }

          // Confirm user automatically to avoid email confirmation
          try {
            await supabase.functions.invoke('confirm-user', {
              body: { userId: data.user.id }
            });
            console.log('User auto-confirmed');
          } catch (confirmError) {
            console.log('Auto-confirm failed, but continuing:', confirmError);
          }

          return { error: null };
        } catch (profileErr) {
          console.error('Profile creation failed:', profileErr);
          return { error: { message: 'Erro ao criar perfil. Tente novamente.' } };
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

      // Sign in with temporary credentials - normalize email format
      const safeEmailUser = profileData.institutional_user
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9.]/g, ''); // Keep only letters, numbers, and dots
      const tempEmail = `${safeEmailUser}@temp.com`;
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: tempEmail,
        password: profileData.institutional_user + pin
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
            
            // Try sign in again
            const { error: retryError } = await supabase.auth.signInWithPassword({
              email: tempEmail,
              password: profileData.institutional_user + pin
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