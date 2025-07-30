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

      console.log('🔄 Starting comprehensive signup cleanup for:', normalizedUser);

      // PHASE 1: Complete database cleanup
      console.log('🧹 Phase 1: Database cleanup...');
      
      // Get all profiles that might conflict
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*');

      const conflictingProfiles = allProfiles?.filter(profile => {
        const storedNormalized = profile.institutional_user
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return storedNormalized === normalizedInput || profile.institutional_user === normalizedUser;
      }) || [];

      console.log(`🧹 Found ${conflictingProfiles.length} conflicting profiles`);

      // Remove all conflicting data
      for (const profile of conflictingProfiles) {
        // Delete reservations first
        await supabase
          .from('reservations')
          .delete()
          .eq('user_id', profile.user_id);
        
        // Delete profile
        await supabase
          .from('profiles')
          .delete()
          .eq('id', profile.id);
        
        console.log(`🗑️ Removed profile and reservations for: ${profile.institutional_user}`);
      }

      // PHASE 2: Auth system cleanup with forced removal
      console.log('🧹 Phase 2: Auth system cleanup...');
      
      try {
        // Try to get existing auth user by email patterns
        const emailPatterns = [
          tempEmail,
          tempEmail.toLowerCase(),
          `${normalizedInput}@temp.com`
        ];

        for (const email of emailPatterns) {
          try {
            // Try to sign in to check if user exists
            const { data: testSignIn } = await supabase.auth.signInWithPassword({
              email: email,
              password: '000000' // Dummy password
            });
            
            // If we get here without error, user might exist but we'll handle it differently
          } catch (testError) {
            // Expected - user doesn't exist or wrong password
          }
        }

        // Force cleanup using admin API if available
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        if (authUsers?.users) {
          for (const email of emailPatterns) {
            const existingAuthUser = authUsers.users.find((u: any) => u.email === email);
            if (existingAuthUser) {
              await supabase.auth.admin.deleteUser(existingAuthUser.id);
              console.log(`🗑️ Force deleted auth user: ${email}`);
            }
          }
        }
      } catch (authCleanupError: any) {
        console.log(`⚠️ Auth cleanup warning: ${authCleanupError.message}`);
        // Continue anyway
      }

      // Wait for cleanup to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // PHASE 3: Create new user with retry mechanism
      console.log('🔄 Phase 3: Creating new auth user...');
      
      const bcrypt = await import('bcryptjs');
      const pinHash = await bcrypt.hash(pin, 10);

      let createAttempts = 0;
      let authResult = null;
      let lastError = null;

      while (createAttempts < 5) { // Increased retry attempts
        createAttempts++;
        console.log(`🔄 Auth creation attempt ${createAttempts}/5`);
        
        try {
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
            console.log('✅ Auth user created successfully');
            break;
          } else if (error) {
            lastError = error;
            console.log(`❌ Attempt ${createAttempts} failed: ${error.message}`);
            
            // If "already registered" error, try to force delete and retry
            if (error.message.includes('already registered') || error.message.includes('Email already registered')) {
              console.log('🔧 Trying additional cleanup...');
              
               // Try aggressive cleanup
               try {
                 const { data: authUsers } = await supabase.auth.admin.listUsers();
                 if (authUsers?.users) {
                   const conflictUser = authUsers.users.find((u: any) => u.email === tempEmail);
                   if (conflictUser) {
                     await supabase.auth.admin.deleteUser(conflictUser.id);
                     console.log('🗑️ Force deleted conflicting auth user');
                     await new Promise(resolve => setTimeout(resolve, 2000));
                   }
                 }
               } catch (forceError: any) {
                 console.log(`⚠️ Force cleanup failed: ${forceError.message}`);
               }
            }
            
            // Wait longer between retries
            await new Promise(resolve => setTimeout(resolve, 3000 * createAttempts));
          }
        } catch (exception) {
          lastError = exception;
          console.log(`❌ Exception in attempt ${createAttempts}: ${exception.message}`);
          await new Promise(resolve => setTimeout(resolve, 2000 * createAttempts));
        }
      }

      if (!authResult || !authResult.user) {
        console.error('❌ All auth creation attempts failed');
        if (lastError?.message.includes('already registered')) {
          return { error: { message: 'Usuário já existe no sistema. Tente fazer login ou use um nome de usuário diferente.' } };
        }
        return { error: { message: `Erro na criação da conta: ${lastError?.message || 'Falha após múltiplas tentativas'}` } };
      }

      // PHASE 4: Confirm user and create profile
      console.log('🔄 Phase 4: Confirming user and creating profile...');
      
      try {
        // Auto-confirm user
        const { error: confirmError } = await supabase.functions.invoke('confirm-user', {
          body: { userId: authResult.user.id }
        });
        
        if (confirmError) {
          console.warn('⚠️ Auto-confirm warning:', confirmError.message);
        } else {
          console.log('✅ User confirmed successfully');
        }
        
        // Wait for confirmation to propagate
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create profile using RPC
        const { error: profileError } = await supabase.rpc('handle_signup_with_profile', {
          p_display_name: displayName,
          p_institutional_user: normalizedUser,
          p_pin_hash: pinHash,
          p_user_id: authResult.user.id
        });

        if (profileError) {
          console.error('❌ Profile creation error:', profileError);
          
          // Cleanup auth user on profile failure
          try {
            await supabase.auth.admin.deleteUser(authResult.user.id);
          } catch (cleanupError) {
            console.error('Failed to cleanup auth user:', cleanupError);
          }
          
          return { error: { message: 'Erro ao criar perfil. Tente novamente.' } };
        }
        
        console.log('✅ Signup completed successfully for:', normalizedUser);
        return { error: null };
        
      } catch (finalError) {
        console.error('❌ Final phase error:', finalError);
        
        // Final cleanup
        try {
          await supabase.auth.admin.deleteUser(authResult.user.id);
        } catch (cleanupError) {
          console.error('Failed final cleanup:', cleanupError);
        }
        
        return { error: { message: 'Erro final no processo de cadastro. Tente novamente.' } };
      }

    } catch (error) {
      console.error('❌ Overall signup error:', error);
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