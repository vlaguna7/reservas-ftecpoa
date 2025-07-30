import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

export function DebugCleanup() {
  const [institutionalUser, setInstitutionalUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const performDeepCleanup = async (username: string) => {
    setLoading(true);
    const info: any = { steps: [] };
    
    try {
      info.steps.push(`🔍 Starting deep cleanup for: ${username}`);
      
      // Step 1: Check profiles table
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*');
      
      const matchingProfiles = profiles?.filter(p => 
        p.institutional_user.toLowerCase().includes(username.toLowerCase()) ||
        p.institutional_user.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === username.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      ) || [];
      
      info.profiles = matchingProfiles;
      info.steps.push(`📋 Found ${matchingProfiles.length} matching profiles`);
      
      // Step 2: Delete all reservations for matching users
      for (const profile of matchingProfiles) {
        const { data: reservations } = await supabase
          .from('reservations')
          .delete()
          .eq('user_id', profile.user_id)
          .select();
        
        info.steps.push(`🗑️ Deleted ${reservations?.length || 0} reservations for ${profile.institutional_user}`);
      }
      
      // Step 3: Delete matching profiles
      for (const profile of matchingProfiles) {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', profile.id);
        
        if (error) {
          info.steps.push(`❌ Error deleting profile ${profile.institutional_user}: ${error.message}`);
        } else {
          info.steps.push(`✅ Deleted profile: ${profile.institutional_user}`);
        }
      }
      
      // Step 4: Try to find and delete auth users
      try {
        const { data: authData } = await supabase.auth.admin.listUsers();
        const authUsers = authData?.users || [];
        
        const targetEmails = [
          `${username}@temp.com`,
          `${username.toLowerCase()}@temp.com`,
          `${username.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@temp.com`
        ];
        
        for (const email of targetEmails) {
          const authUser = authUsers.find(u => u.email === email);
          if (authUser) {
            const { error: authDeleteError } = await supabase.auth.admin.deleteUser(authUser.id);
            if (authDeleteError) {
              info.steps.push(`❌ Error deleting auth user ${email}: ${authDeleteError.message}`);
            } else {
              info.steps.push(`✅ Deleted auth user: ${email}`);
            }
          }
        }
        
        info.steps.push(`🔍 Checked ${authUsers.length} auth users total`);
      } catch (authError) {
        info.steps.push(`⚠️ Could not check auth users: ${authError.message}`);
      }
      
      // Step 5: Wait and verify cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { data: finalProfiles } = await supabase
        .from('profiles')
        .select('*');
      
      const remainingProfiles = finalProfiles?.filter(p => 
        p.institutional_user.toLowerCase().includes(username.toLowerCase())
      ) || [];
      
      info.steps.push(`✅ Cleanup complete. Remaining profiles: ${remainingProfiles.length}`);
      info.finalProfiles = remainingProfiles;
      
      setDebugInfo(info);
      
      toast({
        title: "Deep cleanup completed",
        description: `Cleanup for ${username} finished. Check debug info below.`
      });
      
    } catch (error) {
      info.steps.push(`❌ Cleanup error: ${error.message}`);
      setDebugInfo(info);
      
      toast({
        title: "Cleanup error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const quickCleanupVitor = () => performDeepCleanup('vitor.souza');
  const quickCleanupCamila = () => performDeepCleanup('camilasantos');

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>🔧 Debug & Deep Cleanup Tool</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button 
            onClick={quickCleanupVitor}
            disabled={loading}
            variant="destructive"
          >
            🧹 Deep Clean: vitor.souza
          </Button>
          
          <Button 
            onClick={quickCleanupCamila}
            disabled={loading}
            variant="destructive"
          >
            🧹 Deep Clean: camilasantos
          </Button>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="username">Custom cleanup:</Label>
          <div className="flex gap-2">
            <Input
              id="username"
              value={institutionalUser}
              onChange={(e) => setInstitutionalUser(e.target.value)}
              placeholder="Enter institutional user"
            />
            <Button 
              onClick={() => performDeepCleanup(institutionalUser)}
              disabled={loading || !institutionalUser}
              variant="outline"
            >
              🧹 Deep Clean
            </Button>
          </div>
        </div>
        
        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Performing deep cleanup...</p>
          </div>
        )}
        
        {debugInfo && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">🔍 Debug Information:</h3>
            <div className="space-y-1 text-sm font-mono">
              {debugInfo.steps.map((step: string, index: number) => (
                <div key={index} className="whitespace-pre-wrap">{step}</div>
              ))}
            </div>
            
            {debugInfo.profiles && debugInfo.profiles.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold">Found Profiles:</h4>
                <pre className="text-xs bg-background p-2 rounded mt-1 overflow-auto">
                  {JSON.stringify(debugInfo.profiles, null, 2)}
                </pre>
              </div>
            )}
            
            {debugInfo.finalProfiles && (
              <div className="mt-4">
                <h4 className="font-semibold">Remaining Profiles After Cleanup:</h4>
                <pre className="text-xs bg-background p-2 rounded mt-1 overflow-auto">
                  {JSON.stringify(debugInfo.finalProfiles, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}