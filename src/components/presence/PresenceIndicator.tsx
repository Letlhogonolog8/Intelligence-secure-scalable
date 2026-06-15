import { useState } from "react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/data/aegisData";
import { usePresence } from "@/hooks/usePresence";

/**
 * Live "who's online" indicator for the staff portal header. Shows a count of
 * staff currently connected (Supabase Realtime Presence) with a dropdown roster
 * of names + roles — a lightweight presence / live-collaboration cue so
 * responders can see who else is working a shift in real time.
 */

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const PresenceIndicator: React.FC<{ className?: string }> = ({ className }) => {
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const [open, setOpen] = useState(false);
  const members = usePresence({
    userId: user?.id,
    name: profile?.fullName || "Staff member",
    role: profile?.role,
  });

  if (!user?.id) return null;

  const count = members.length;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`${count} staff online`}
        className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <Users className="h-3.5 w-3.5" />
        {count || 1}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-white/10 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl">
            <p className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Online now ({count || 1})
            </p>
            <ul className="max-h-64 overflow-y-auto">
              {members.length === 0 ? (
                <li className="px-2 py-2 text-xs text-slate-400">
                  You're the only one online right now.
                </li>
              ) : (
                members.map((member) => (
                  <li
                    key={member.userId}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
                  >
                    <span className="truncate text-sm text-white">
                      {member.name}
                      {member.userId === user.id ? (
                        <span className="text-slate-500"> (you)</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/80">
                      {titleCase(member.role)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default PresenceIndicator;
