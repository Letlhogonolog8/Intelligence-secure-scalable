import { Button } from "@/components/ui/button";

type AdminQueryErrorBannerProps = {
  title: string;
  message: string;
  onRetry?: () => void;
};

export function AdminQueryErrorBanner({ title, message, onRetry }: AdminQueryErrorBannerProps) {
  return (
  <div
    className="rounded-xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 text-sm text-rose-100 mb-4"
    role="status"
  >
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-semibold text-rose-200">{title}</p>
        <p className="mt-1 text-rose-100/85 text-xs sm:text-sm">{message}</p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-rose-400/40 text-rose-100 hover:bg-rose-500/20 hover:text-white"
          onClick={() => onRetry()}
        >
          Retry
        </Button>
      ) : null}
    </div>
  </div>
  );
}
