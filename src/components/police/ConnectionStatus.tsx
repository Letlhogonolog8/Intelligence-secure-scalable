import { WifiOff } from "lucide-react";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";

export const ConnectionStatus = () => {
  const isOnline = useConnectionStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-0 z-50 border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 backdrop-blur-md">
      <div className="flex items-center justify-center gap-2 text-center text-sm text-rose-300">
        <WifiOff className="h-4 w-4" />
        <span>You&apos;re offline. Some features may be limited.</span>
      </div>
    </div>
  );
};
