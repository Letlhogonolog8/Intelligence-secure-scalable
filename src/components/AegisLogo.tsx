import { useState } from "react";
import { Shield, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AEGIS-AI brand logo. Renders the logo image when present, and gracefully
 * falls back to the gradient shield mark if the asset is missing — so the app
 * never shows a broken image.
 *
 * To enable the logo: save the AEGIS-AI logo PNG to  public/aegis-logo.png
 * (it is served at the site root as `/aegis-logo.png`).
 */
export function AegisLogo({
  size = 40,
  rounded = "rounded-xl",
  fallbackIcon: Fallback = Shield,
  src = "/aegis-logo.png",
  className,
}: {
  size?: number;
  rounded?: string;
  fallbackIcon?: LucideIcon;
  src?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const dim = { height: size, width: size };

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-violet-600 via-purple-500 to-pink-500 shadow-lg shadow-purple-600/30",
          rounded,
          className,
        )}
        style={dim}
      >
        <Fallback
          className="text-white"
          style={{ height: size * 0.5, width: size * 0.5 }}
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="AEGIS-AI"
      onError={() => setFailed(true)}
      className={cn("object-contain", rounded, className)}
      style={dim}
    />
  );
}

export default AegisLogo;
