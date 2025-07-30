import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

export function AdminResetPin() {
  const { resetUserPin } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleResetVitorPin = async () => {
    setLoading(true);
    try {
      const { error } = await resetUserPin('vitor.souza', '161903');
      if (error) {
        toast({
          title: "Erro",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Sucesso",
          description: "PIN do vitor.souza redefinido para 161903"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro inesperado",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Reset PIN Admin</h2>
      <Button 
        onClick={handleResetVitorPin}
        disabled={loading}
        className="mb-4"
      >
        {loading ? 'Redefinindo...' : 'Redefinir PIN do vitor.souza para 161903'}
      </Button>
    </div>
  );
}