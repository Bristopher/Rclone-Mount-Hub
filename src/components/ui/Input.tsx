import { forwardRef } from "react";
import { clsx } from "clsx";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = "text", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <input
          type={type}
          className={clsx(
            "h-10 px-3 rounded-lg bg-bg-overlay border border-border-default",
            "text-text-primary placeholder:text-text-tertiary",
            "focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue",
            "transition-all duration-150",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-accent-red focus:ring-accent-red/50 focus:border-accent-red",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-sm text-accent-red">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
