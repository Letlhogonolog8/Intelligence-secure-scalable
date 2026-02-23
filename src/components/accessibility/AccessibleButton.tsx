import React from 'react';

interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
  isLoading?: boolean;
  traumaInformed?: boolean;
  children: React.ReactNode;
}

/**
 * WCAG AA Accessible Button Component
 * - Proper contrast ratios (4.5:1 for text)
 * - Clear focus indicators
 * - Keyboard navigation support
 * - Trauma-informed design (no jarring animations)
 */
export const AccessibleButton = React.forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      ariaLabel,
      isLoading = false,
      traumaInformed = true,
      className = '',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
      primary: 'bg-blue-600 text-white hover:bg-blue-500 focus:ring-blue-500',
      secondary: 'bg-slate-600 text-white hover:bg-slate-500 focus:ring-slate-500',
      danger: 'bg-rose-600 text-white hover:bg-rose-500 focus:ring-rose-500',
      success: 'bg-emerald-600 text-white hover:bg-emerald-500 focus:ring-emerald-500',
    };

    const sizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const animationClass = traumaInformed ? '' : 'hover:scale-105';

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${animationClass} ${className}`}
        disabled={disabled || isLoading}
        aria-label={ariaLabel || typeof children === 'string' ? (children as string) : undefined}
        aria-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="inline-block animate-spin mr-2">⟳</span>
            Loading...
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';
