import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { User, Edit3, Save, X } from 'lucide-react';

export function Profile() {
  const { profile, updateProfile } = useAuth();
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
    if (formData.newPin || formData.confirmPin) {
      if (!validatePin(formData.newPin)) {
        toast({
          title: "PIN inválido",
          description: "O PIN deve conter exatamente 6 dígitos numéricos.",
          variant: "destructive"
        });
        return;
      }

      if (formData.newPin !== formData.confirmPin) {
        toast({
          title: "PINs não coincidem",
          description: "Os PINs digitados não são iguais.",
          variant: "destructive"
        });
        return;
      }
    }

    setLoading(true);

    const updates: any = {
      display_name: formData.display_name,
      institutional_user: formData.institutional_user
    };

    if (formData.newPin) {
      const bcrypt = await import('bcryptjs');
      updates.pin_hash = await bcrypt.hash(formData.newPin, 10);
    }

    const { error } = await updateProfile(updates);

    if (error) {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso."
      });
      setIsEditing(false);
      setFormData(prev => ({ ...prev, newPin: '', confirmPin: '' }));
    }

    setLoading(false);
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