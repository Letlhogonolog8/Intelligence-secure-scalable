import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { AlertTriangle, MapPin, Phone, RefreshCw } from 'lucide-react';

interface PanicButtonProps {
  onActivate?: () => void;
}

export const PanicButton: React.FC<PanicButtonProps> = ({ onActivate }) => {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const handlePanicPress = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const location = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => reject(err)
        );
      });

      const { data: escalation, error } = await supabase
        .from('escalation_events')
        .insert({
          user_id: user?.id,
          case_id: null,
          escalation_type: 'panic_button',
          severity: 'critical',
          location: { lat: location.lat, lng: location.lng },
          status: 'triggered',
          triggered_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setIsActive(true);
      setCountdown(120);
      setMessage('Emergency alert sent to nearest authorities. Help is on the way.');

      onActivate?.();

      let timer = 120;
      const interval = setInterval(() => {
        timer -= 1;
        setCountdown(timer);
        if (timer <= 0) {
          clearInterval(interval);
        }
      }, 1000);

      setTimeout(() => {
        if (escalation) {
          supabase
            .from('escalation_events')
            .update({ status: 'acknowledged' })
            .eq('id', escalation.id)
            .then(() => setIsActive(false));
        }
      }, 120000);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to send emergency alert');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      className={`p-8 backdrop-blur-xl border transition-all ${
        isActive
          ? 'bg-rose-500/20 border-rose-500/50 shadow-2xl shadow-rose-500/20'
          : 'border-white/10 bg-slate-900/40'
      }`}
    >
      <div className="text-center space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-white mb-2">Emergency Panic Button</h3>
          <p className="text-sm text-slate-400">
            {isActive
              ? 'Emergency alert is active. Help has been notified.'
              : 'Press in case of immediate danger'}
          </p>
        </div>

        {isActive && countdown > 0 && (
          <div className="text-center py-4 px-6 rounded-lg bg-rose-500/10 border border-rose-500/30">
            <p className="text-4xl font-black text-rose-300 font-mono">{countdown}s</p>
            <p className="text-xs text-rose-300 mt-2 uppercase font-bold">Alert Active</p>
          </div>
        )}

        <Button
          onClick={handlePanicPress}
          disabled={loading || isActive}
          size="lg"
          className={`w-full h-24 text-2xl font-bold transition-all ${
            isActive
              ? 'bg-rose-600 hover:bg-rose-600 text-white animate-pulse'
              : 'bg-rose-600 hover:bg-rose-500 text-white'
          }`}
        >
          {loading ? (
            <>
              <RefreshCw className="mr-3 h-6 w-6 animate-spin" />
              Activating...
            </>
          ) : isActive ? (
            <>
              <AlertTriangle className="mr-3 h-8 w-8 animate-bounce" />
              ALERT ACTIVE
            </>
          ) : (
            <>
              <AlertTriangle className="mr-3 h-8 w-8" />
              EMERGENCY
            </>
          )}
        </Button>

        {message && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <p className="text-sm text-emerald-300 font-semibold">{message}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
          <div className="text-center">
            <Phone className="h-5 w-5 text-blue-400 mx-auto mb-2" />
            <p className="text-xs font-bold uppercase text-slate-400 mb-1">Hotline</p>
            <p className="text-lg font-bold text-white">0800 AEGIS</p>
          </div>
          <div className="text-center">
            <MapPin className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
            <p className="text-xs font-bold uppercase text-slate-400 mb-1">Location</p>
            <p className="text-sm text-slate-300">Auto-shared</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
