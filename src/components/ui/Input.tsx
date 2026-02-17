import { forwardRef } from "react";
import { clsx } from "clsx";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ElementType;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, icon: Icon, type = "text", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-[13px] font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
          )}
          <input
            type={type}
            className={clsx(
              "h-10 rounded-lg bg-white/[0.03] border border-white/[0.06]",
              "text-[13px] text-text-primary placeholder:text-text-tertiary",
              "focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue/50 focus:bg-white/[0.05]",
              "hover:border-white/[0.12] hover:bg-white/[0.04]",
              "transition-all duration-150",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-accent-red focus:ring-accent-red/30 focus:border-accent-red",
              Icon ? "pl-9 pr-3" : "px-3",
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {hint && !error && (
          <p className="text-[11px] text-text-tertiary">{hint}</p>
        )}
        {error && <p className="text-[11px] text-accent-red">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
