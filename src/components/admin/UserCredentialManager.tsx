import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Mail,
  Lock,
  Shield,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
} from 'lucide-react';

interface UserCredentialManagerProps {
  onSuccess?: () => void;
}

export const UserCredentialManager: React.FC<UserCredentialManagerProps> = ({ onSuccess }) => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'police' | 'ngo' | 'counselor' | 'analyst'>('police');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const generatePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const tempPassword = generatePassword();
      setGeneratedPassword(tempPassword);

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: false,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            role,
            is_active: true,
            mfa_enabled: role === 'police' || role === 'analyst',
          });

        if (profileError) throw profileError;

        setSuccess(`User created successfully. Temporary password: ${tempPassword}`);
        setEmail('');
        setFullName('');
        queryClient.invalidateQueries({ queryKey: ['aegis', 'userProfiles'] });
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
      setGeneratedPassword(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <UserPlus className="h-5 w-5 text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-white">Create User Credentials</h3>
      </div>

      <form onSubmit={handleCreateUser} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Full Name</label>
          <Input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Officer John Doe"
            required
            className="bg-slate-950/60 border-white/10 text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Email Address</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="officer@police.gov.za"
            required
            className="bg-slate-950/60 border-white/10 text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="w-full px-4 py-2 rounded-lg bg-slate-950/60 border border-white/10 text-white"
          >
            <option value="police">Police Officer</option>
            <option value="ngo">NGO Staff</option>
            <option value="counselor">Counselor</option>
            <option value="analyst">Analyst</option>
          </select>
        </div>

        {generatedPassword && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="flex items-start gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-300 mb-2">Temporary Password</p>
                <div className="flex items-center gap-2 bg-slate-950/60 p-2 rounded">
                  <code className="text-xs text-white flex-1 font-mono break-all">{generatedPassword}</code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(generatedPassword)}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    <Copy className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Share with user via secure channel. They must change on first login.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2">
            <XCircle className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-300">{success}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold"
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Create User Account
            </>
          )}
        </Button>
      </form>
    </Card>
  );
};
