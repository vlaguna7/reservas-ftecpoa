import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { User, Edit3, Save, X } from 'lucide-react';

export function Profile() {
  const { profile, updateProfile, resetUserPin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: profile?.display_name || '',
    institutional_user: profile?.institutional_user || '',
    newPin: '',
    confirmPin: ''
  });

  if (!profile) return null;

  const validatePin = (pin: string) => {
    return /^\d{6}$/.test(pin);
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      // Handle PIN change if provided
      if (formData.newPin || formData.confirmPin) {
        if (!validatePin(formData.newPin)) {
          toast({
            title: "PIN inválido",
            description: "O PIN deve conter exatamente 6 dígitos numéricos.",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        if (formData.newPin !== formData.confirmPin) {
          toast({
            title: "PINs não coincidem",
            description: "Os PINs digitados não são iguais.",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        console.log('🔐 Updating PIN for user:', profile.institutional_user);
        
        try {
          // Hash the new PIN
          const bcrypt = await import('bcryptjs');
          const newPinHash = await bcrypt.hash(formData.newPin, 10);
          
          // Update PIN hash in profiles table using direct supabase call
          const { error: pinHashError } = await supabase
            .from('profiles')
            .update({ pin_hash: newPinHash })
            .eq('user_id', profile.user_id);
          
          if (pinHashError) {
            toast({
              title: "Erro ao alterar PIN",
              description: `Erro na base de dados: ${pinHashError.message}`,
              variant: "destructive"
            });
            setLoading(false);
            return;
          }

          // Try to update password in Auth system using edge function
          try {
            const { data: authData, error: authUpdateError } = await supabase.functions.invoke('update-user-password', {
              body: { 
                userId: profile.user_id, 
                newPassword: formData.newPin 
              }
            });

            if (authUpdateError) {
              // Check if it's a 404 (function not found) or other error
              if (authUpdateError.message?.includes('404') || authUpdateError.message?.includes('Not Found')) {
                // Fallback: try direct admin API call
                try {
                  const { data: directAuthData, error: directAuthError } = await supabase.auth.admin.updateUserById(
                    profile.user_id,
                    { password: formData.newPin }
                  );
                  
                  if (directAuthError) {
                    toast({
                      title: "PIN parcialmente atualizado",
                      description: "PIN atualizado na base de dados. Faça logout e login novamente para sincronizar.",
                      variant: "default"
                    });
                  } else {
                    toast({
                      title: "PIN alterado com sucesso!",
                      description: "Seu PIN foi atualizado completamente."
                    });
                  }
                } catch (directError: any) {
                  toast({
                    title: "PIN parcialmente atualizado",
                    description: "PIN atualizado na base de dados. Faça logout e login para sincronizar.",
                    variant: "default"
                  });
                }
              } else {
                toast({
                  title: "PIN parcialmente atualizado",
                  description: "PIN atualizado na base de dados. Você pode precisar fazer logout/login.",
                  variant: "default"
                });
              }
            } else {
              toast({
                title: "PIN alterado com sucesso!",
                description: "Seu PIN foi atualizado completamente."
              });
            }
          } catch (authError: any) {
            // Try direct admin API as fallback
            try {
              const { data: fallbackData, error: fallbackError } = await supabase.auth.admin.updateUserById(
                profile.user_id,
                { password: formData.newPin }
              );
              
              if (fallbackError) {
                toast({
                  title: "PIN parcialmente atualizado",
                  description: "PIN atualizado na base de dados. Faça logout e login para sincronizar.",
                  variant: "default"
                });
              } else {
                toast({
                  title: "PIN alterado com sucesso!",
                  description: "Seu PIN foi atualizado completamente."
                });
              }
            } catch (fallbackError: any) {
              toast({
                title: "PIN parcialmente atualizado",
                description: "PIN atualizado na base de dados. Faça logout e login para sincronizar.",
                variant: "default"
              });
            }
          }

        } catch (pinError: any) {
          toast({
            title: "Erro ao alterar PIN",
            description: `Erro interno: ${pinError.message}`,
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
      }

      // Handle other profile updates (name, institutional_user)
      const hasOtherUpdates = 
        formData.display_name !== profile.display_name || 
        formData.institutional_user !== profile.institutional_user;

      if (hasOtherUpdates) {
        const updates = {
          display_name: formData.display_name,
          institutional_user: formData.institutional_user
        };

        const { error: profileError } = await updateProfile(updates);

        if (profileError) {
          toast({
            title: "Erro ao atualizar perfil",
            description: profileError.message,
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        
        if (!formData.newPin) {
          toast({
            title: "Perfil atualizado!",
            description: "Suas informações foram salvas com sucesso."
          });
        }
      }

      if (!formData.newPin && !hasOtherUpdates) {
        toast({
          title: "Nenhuma alteração",
          description: "Não foram feitas alterações para salvar.",
          variant: "default"
        });
      }

      setIsEditing(false);
      setFormData(prev => ({ ...prev, newPin: '', confirmPin: '' }));

    } catch (error: any) {
      toast({
        title: "Erro interno",
        description: "Erro inesperado ao salvar. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      display_name: profile.display_name,
      institutional_user: profile.institutional_user,
      newPin: '',
      confirmPin: ''
    });
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informações Pessoais
          </CardTitle>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="display-name">Nome de Exibição</Label>
            {isEditing ? (
              <Input
                id="display-name"
                value={formData.display_name}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="Prof. Vinicius Souza"
              />
            ) : (
              <div className="p-2 bg-muted rounded-md">{profile.display_name}</div>
            )}
          </div>

          <div>
            <Label htmlFor="institutional-user">Usuário Institucional</Label>
            {isEditing ? (
              <Input
                id="institutional-user"
                value={formData.institutional_user}
                onChange={(e) => setFormData(prev => ({ ...prev, institutional_user: e.target.value }))}
                placeholder="v.souza"
              />
            ) : (
              <div className="p-2 bg-muted rounded-md">{profile.institutional_user}</div>
            )}
          </div>

          {isEditing && (
            <>
              <div>
                <Label htmlFor="new-pin">Novo PIN (6 dígitos) - Deixe em branco para manter o atual</Label>
                <Input
                  id="new-pin"
                  type="password"
                  placeholder="123456"
                  maxLength={6}
                  value={formData.newPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData(prev => ({ ...prev, newPin: value }));
                  }}
                />
              </div>

              <div>
                <Label htmlFor="confirm-pin">Confirmar Novo PIN</Label>
                <Input
                  id="confirm-pin"
                  type="password"
                  placeholder="123456"
                  maxLength={6}
                  value={formData.confirmPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData(prev => ({ ...prev, confirmPin: value }));
                  }}
                />
              </div>
            </>
          )}

          {isEditing && (
            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Conta</Label>
              <div className="p-2 bg-muted rounded-md">
                {profile.is_admin ? 'Administrador' : 'Professor'}
              </div>
            </div>
            <div>
              <Label>Data de Cadastro</Label>
              <div className="p-2 bg-muted rounded-md">
                {new Date(profile.created_at).toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}