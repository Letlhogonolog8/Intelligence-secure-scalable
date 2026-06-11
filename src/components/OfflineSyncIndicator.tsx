import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Upload } from "lucide-react";
import { useOfflineSync } from "@/hooks/useOfflineSync";

export const OfflineSyncIndicator: React.FC = () => {
  const { isOnline, pendingCount, isSyncing, lastSyncAt, syncNow } = useOfflineSync();

  const showBanner = !isOnline || pendingCount > 0 || isSyncing;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.25 }}
          className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-4 py-2 text-xs font-semibold shadow-lg ${
            !isOnline
              ? "bg-amber-600 text-white"
              : isSyncing
              ? "bg-blue-700 text-white"
              : "bg-emerald-700 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <WifiOff className="h-3.5 w-3.5 shrink-0" />
            ) : isSyncing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>
              {!isOnline
                ? `You're offline. ${pendingCount > 0 ? `${pendingCount} report${pendingCount !== 1 ? "s" : ""} queued — will sync when reconnected.` : "Reports will be saved locally."}`
                : isSyncing
                ? "Syncing offline reports…"
                : `${pendingCount} report${pendingCount !== 1 ? "s" : ""} synced successfully.`}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {lastSyncAt && isOnline && !isSyncing && (
              <span className="opacity-70">
                Last sync: {lastSyncAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            {pendingCount > 0 && isOnline && !isSyncing && (
              <button
                onClick={syncNow}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 transition-colors"
              >
                <Upload className="h-3 w-3" />
                Sync now
              </button>
            )}
          </div>
        </motion.div>
      )}

      {!showBanner && isOnline && (
        <motion.div
          key="online-pill"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 bg-slate-900/90 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg backdrop-blur pointer-events-none"
        >
          <Wifi className="h-3 w-3" />
          Live
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineSyncIndicator;
