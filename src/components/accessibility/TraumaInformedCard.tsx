import React from 'react';

interface TraumaInformedCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  variant?: 'neutral' | 'calm' | 'supportive' | 'safe';
  hasCloseButton?: boolean;
  onClose?: () => void;
  className?: string;
}

/**
 * Trauma-Informed Card Component
 * - Soft color palette (blues and greens)
 * - No sudden changes or jarring animations
 * - Emphasis on safety and control
 * - Empowerment-focused language
 */
export const TraumaInformedCard: React.FC<TraumaInformedCardProps> = ({
  title,
  description,
  children,
  variant = 'neutral',
  hasCloseButton = false,
  onClose,
  className = '',
}) => {
  const colorSchemes = {
    neutral: {
      bg: 'bg-slate-900/40',
      border: 'border-slate-500/30',
      title: 'text-slate-200',
      description: 'text-slate-400',
    },
    calm: {
      bg: 'bg-blue-900/20',
      border: 'border-blue-500/30',
      title: 'text-blue-300',
      description: 'text-blue-400',
    },
    supportive: {
      bg: 'bg-emerald-900/20',
      border: 'border-emerald-500/30',
      title: 'text-emerald-300',
      description: 'text-emerald-400',
    },
    safe: {
      bg: 'bg-purple-900/20',
      border: 'border-purple-500/30',
      title: 'text-purple-300',
      description: 'text-purple-400',
    },
  };

  const scheme = colorSchemes[variant];

  return (
    <div
      className={`
        ${scheme.bg}
        ${scheme.border}
        rounded-xl border
        backdrop-blur-md
        p-6
        transition-all duration-300
        hover:border-opacity-100
        ${className}
      `}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {title && (
            <h3 className={`${scheme.title} text-lg font-semibold mb-2`}>
              {title}
            </h3>
          )}
          {description && (
            <p className={`${scheme.description} text-sm mb-4 leading-relaxed`}>
              {description}
            </p>
          )}
        </div>
        {hasCloseButton && onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-4">
        {children}
      </div>
    </div>
  );
};

/**
 * Trauma-Informed Alert Component
 */
export const TraumaInformedAlert: React.FC<{
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
  details?: string;
  action?: { label: string; onClick: () => void };
}> = ({ type, message, details, action }) => {
  const icons = {
    info: 'ℹ️',
    warning: '⚠️',
    success: '✓',
    error: '🛑',
  };

  const colors = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    error: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
  };

  return (
    <div className={`${colors[type]} rounded-lg border p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{icons[type]}</span>
        <div className="flex-1">
          <p className="font-semibold">{message}</p>
          {details && <p className="text-sm opacity-90 mt-1">{details}</p>}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 text-sm font-semibold hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

/**
 * Trauma-Informed Loading Spinner
 * - Gentle, non-jarring animation
 * - Empowering message
 */
export const TraumaInformedSpinner: React.FC<{ message?: string }> = ({
  message = 'Loading...',
}) => {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin opacity-70" />
      <p className="text-slate-400 text-sm font-medium">{message}</p>
    </div>
  );
};

/**
 * Trauma-Informed Modal Backdrop
 * - No rapid animations
 * - Clear controls
 * - Visible focus indicators
 */
export const TraumaInformedModal: React.FC<{
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  actions?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }[];
}> = ({ isOpen, title, children, onClose, actions }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-900/95 border border-white/10 rounded-2xl p-8 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
        <div className="text-slate-300 mb-6">
          {children}
        </div>

        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors focus:ring-2 focus:ring-slate-500"
          >
            Cancel
          </button>
          {actions?.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors focus:ring-2 ${
                action.variant === 'secondary'
                  ? 'bg-slate-700 hover:bg-slate-600 text-white focus:ring-slate-500'
                  : 'bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-500'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
