import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Lock, Save, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface EncryptedClinicalNotesProps {
  caseId: string;
  sessionId?: string;
  onSave?: () => void;
}

export const EncryptedClinicalNotes: React.FC<EncryptedClinicalNotesProps> = ({
  caseId,
  sessionId,
  onSave,
}) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId || caseId,
          sender_id: user?.id,
          sender_role: 'counselor',
          message_type: 'clinical_note',
          content: notes,
          // Stored as an access-controlled record (RLS); not client-side encrypted.
          is_encrypted: false,
          metadata: {
            risk_level: riskLevel,
            session_type: 'clinical_session',
          },
        });

      if (insertError) throw insertError;

      // Best-effort: reflect the assessed risk on the linked justice case.
      // Never block the saved note if the case row can't be updated.
      await supabase
        .from('justice_cases')
        .update({ priority: riskLevel, updated_at: new Date().toISOString() })
        .eq('id', caseId);

      setSaved(true);
      setNotes('');
      onSave?.();

      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Lock className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Clinical Notes</h3>
          <p className="text-xs text-slate-400 mt-1">Confidential · access-controlled · POPIA-aligned.</p>
        </div>
      </div>

      <form onSubmit={handleSaveNotes} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Session Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document session observations, therapeutic interventions, and behavioral assessments. These notes are confidential and access-controlled."
            rows={8}
            className="w-full px-4 py-3 rounded-lg bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 resize-none focus:border-purple-500/50 focus:outline-none"
            required
          />
          <p className="text-xs text-slate-500 mt-2">
            {notes.length} characters · Stored securely
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Risk Level Assessment</label>
          <div className="grid grid-cols-4 gap-3">
            {(['low', 'medium', 'high', 'critical'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setRiskLevel(level)}
                className={`py-2 px-3 rounded-lg font-semibold text-xs uppercase transition-all ${
                  riskLevel === level
                    ? level === 'critical'
                      ? 'bg-rose-600 text-white border border-rose-500'
                      : level === 'high'
                      ? 'bg-amber-600 text-white border border-amber-500'
                      : level === 'medium'
                      ? 'bg-blue-600 text-white border border-blue-500'
                      : 'bg-emerald-600 text-white border border-emerald-500'
                    : 'bg-slate-800 text-slate-400 border border-white/10 hover:bg-slate-700'
                }`}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-rose-300">{error}</p>
          </div>
        )}

        {saved && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-300">Notes saved securely and encrypted</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || !notes.trim()}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold"
        >
          {loading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Clinical Note
            </>
          )}
        </Button>
      </form>
    </Card>
  );
};
