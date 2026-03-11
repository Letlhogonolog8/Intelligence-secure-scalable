import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { 
  Building2, 
  AlertTriangle, 
  Plus, 
  Minus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface Shelter {
  id: string;
  name: string;
  location: string;
  total_capacity: number;
  current_occupancy: number;
  phone: string;
}

export const ShelterCapacityTracker: React.FC = () => {
  const [shelters, setShelters] = useState<Shelter[]>([
    {
      id: '1',
      name: 'Safe Haven Johannesburg',
      location: 'Gauteng',
      total_capacity: 45,
      current_occupancy: 38,
      phone: '+27 10 555 1234',
    },
    {
      id: '2',
      name: 'Durban Protection Center',
      location: 'KwaZulu-Natal',
      total_capacity: 32,
      current_occupancy: 25,
      phone: '+27 11 555 5678',
    },
    {
      id: '3',
      name: 'Cape Town Safety House',
      location: 'Western Cape',
      total_capacity: 28,
      current_occupancy: 28,
      phone: '+27 12 555 9012',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const occupancyMetrics = useMemo(() => {
    const totalCapacity = shelters.reduce((sum, s) => sum + s.total_capacity, 0);
    const totalOccupancy = shelters.reduce((sum, s) => sum + s.current_occupancy, 0);
    const availableBeds = totalCapacity - totalOccupancy;
    const occupancyRate = (totalOccupancy / totalCapacity) * 100;

    return {
      totalCapacity,
      totalOccupancy,
      availableBeds,
      occupancyRate,
    };
  }, [shelters]);

  const handleUpdateOccupancy = async (shelterId: string, change: number) => {
    setLoading(true);
    setMessage(null);

    try {
      const shelter = shelters.find((s) => s.id === shelterId);
      if (!shelter) throw new Error('Shelter not found');

      const newOccupancy = Math.max(0, Math.min(shelter.total_capacity, shelter.current_occupancy + change));

      setShelters(
        shelters.map((s) =>
          s.id === shelterId ? { ...s, current_occupancy: newOccupancy } : s
        )
      );

      await supabase
        .from('resource_capacity')
        .update({ current_occupancy: newOccupancy })
        .eq('id', shelterId);

      setMessage({
        type: 'success',
        text: `${shelter.name} occupancy updated to ${newOccupancy}/${shelter.total_capacity}`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update occupancy',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Total Capacity</p>
          <p className="text-3xl font-bold text-blue-400">{occupancyMetrics.totalCapacity}</p>
        </Card>
        <Card className="border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Current Occupancy</p>
          <p className="text-3xl font-bold text-slate-300">{occupancyMetrics.totalOccupancy}</p>
        </Card>
        <Card className="border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Available Beds</p>
          <p className={`text-3xl font-bold ${occupancyMetrics.availableBeds < 5 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {occupancyMetrics.availableBeds}
          </p>
        </Card>
        <Card className="border-white/10 bg-slate-900/40 p-4 backdrop-blur-xl">
          <p className="text-xs text-slate-400 font-semibold uppercase mb-2">Occupancy Rate</p>
          <p className={`text-3xl font-bold ${occupancyMetrics.occupancyRate > 85 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {Math.round(occupancyMetrics.occupancyRate)}%
          </p>
        </Card>
      </div>

      {/* Shelters List */}
      <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Building2 className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Shelter Network</h3>
        </div>

        <div className="space-y-4">
          {shelters.map((shelter) => {
            const occupancyRate = (shelter.current_occupancy / shelter.total_capacity) * 100;
            const isAtCapacity = occupancyRate >= 100;
            const isAlmostFull = occupancyRate >= 85;

            return (
              <div key={shelter.id} className="p-4 rounded-lg border border-white/10 bg-slate-950/60 hover:border-emerald-500/30 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-white">{shelter.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{shelter.location}</p>
                  </div>
                  {isAtCapacity && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30">
                      <AlertTriangle className="h-3 w-3 text-rose-400" />
                      <span className="text-xs font-bold text-rose-300">FULL</span>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-300">
                      {shelter.current_occupancy} / {shelter.total_capacity} beds
                    </span>
                    <span className={`text-sm font-bold ${isAlmostFull ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {Math.round(occupancyRate)}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isAtCapacity ? 'bg-rose-500' : isAlmostFull ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(occupancyRate, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">{shelter.phone}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading || shelter.current_occupancy === 0}
                      onClick={() => handleUpdateOccupancy(shelter.id, -1)}
                      className="h-8 w-8 p-0 border-slate-600 hover:bg-slate-700"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading || isAtCapacity}
                      onClick={() => handleUpdateOccupancy(shelter.id, 1)}
                      className="h-8 w-8 p-0 border-slate-600 hover:bg-slate-700"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {message && (
          <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30'
              : 'bg-rose-500/10 border border-rose-500/30'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-400 mt-0.5 flex-shrink-0" />
            )}
            <p className={`text-sm ${message.type === 'success' ? 'text-emerald-300' : 'text-rose-300'}`}>
              {message.text}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
};
