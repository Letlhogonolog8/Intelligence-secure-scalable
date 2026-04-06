import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useUserProfiles } from '@/data/aegisData';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Mail,
  RefreshCw,
} from 'lucide-react';

export const MFAEnforcementPanel: React.FC = () => {
  const { data: users = [] } = useUserProfiles({ limit: 250 });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mfaEnabledCount = users.filter((u) => u.mfaEnabled).length;
  const mfaDisabledCount = users.filter((u) => !u.mfaEnabled && (u.role === 'police' || u.role === 'admin')).length;
  const mfaCompliancePercentage = users.length > 0 ? Math.round((mfaEnabledCount / users.length) * 100) : 0;

  const handleEnforceMFAForRole = async (role: string) => {
    setLoading(true);
    setMessage(null);

    try {
      const usersToUpdate = users.filter((u) => u.role === role && !u.mfaEnabled);

      for (const user of usersToUpdate) {
        const { error } = await supabase
          .from('user_profiles')
          .update({ mfa_enabled: true })
          .eq('id', user.id);

        if (error) throw error;

        await supabase.from('audit_log').insert({
          table_name: 'user_profiles',
          record_id: user.id,
          operation: 'UPDATE',
          old_values: { mfa_enabled: false },
          new_values: { mfa_enabled: true },
          changed_by: (await supabase.auth.getUser()).data.user?.id,
          changed_at: new Date().toISOString(),
          notes: `MFA enforcement for ${role} role`,
        });
      }

      setMessage({
        type: 'success',
        text: `MFA enabled for ${usersToUpdate.length} ${role} users.`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to enforce MFA',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMFAReminders = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const usersWithoutMFA = users.filter((u) => !u.mfaEnabled && (u.role === 'police' || u.role === 'admin'));

      for (const user of usersWithoutMFA) {
        const userContact = user as unknown as { email?: string | null; full_name?: string | null; fullName?: string | null };
        await supabase.functions.invoke('send-email', {
          body: {
            to: userContact.email,
            subject: 'Action Required: Enable Multi-Factor Authentication',
            template: 'mfa_reminder',
            data: {
              userName: userContact.fullName ?? userContact.full_name,
              deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
            },
          },
        });
      }

      setMessage({
        type: 'success',
        text: `MFA reminder emails sent to ${usersWithoutMFA.length} users.`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to send reminders',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Shield className="h-5 w-5 text-purple-400" />
        </div>
        <h3 className="text-xl font-bold text-white">MFA Enforcement</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-slate-950/60 border border-white/5">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">MFA Enabled</p>
          <p className="text-3xl font-bold text-emerald-400">{mfaEnabledCount}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-950/60 border border-white/5">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">MFA Disabled</p>
          <p className="text-3xl font-bold text-rose-400">{mfaDisabledCount}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-950/60 border border-white/5">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Compliance</p>
          <p className="text-3xl font-bold text-blue-400">{mfaCompliancePercentage}%</p>
        </div>
      </div>

      {mfaDisabledCount > 0 && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 mb-6 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-rose-300 text-sm mb-1">MFA Compliance Gap</p>
            <p className="text-xs text-rose-200">{mfaDisabledCount} users lack MFA protection</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-white/5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-blue-500/10">
              <Shield className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-white">Police Officers</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => handleEnforceMFAForRole('police')}
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          >
            Enforce
          </Button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-white/5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-purple-500/10">
              <Shield className="h-4 w-4 text-purple-400" />
            </div>
            <span className="text-sm font-semibold text-white">Admin Users</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => handleEnforceMFAForRole('admin')}
            className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
          >
            Enforce
          </Button>
        </div>
      </div>

      <Button
        className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold"
        disabled={loading}
        onClick={handleSendMFAReminders}
      >
        {loading ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Send MFA Reminders
          </>
        )}
      </Button>

      {message && (
        <div
          className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-rose-500/10 border border-rose-500/30'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
          )}
          <p className={`text-sm ${message.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
            {message.text}
          </p>
        </div>
      )}
    </Card>
  );
};
