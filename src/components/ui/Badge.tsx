import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
  {
    variants: {
      variant: {
        connected: "bg-accent-green/15 text-accent-green border-accent-green/30",
        disconnected: "bg-accent-red/15 text-accent-red border-accent-red/30",
        connecting: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
        local: "bg-accent-blue/15 text-accent-blue border-accent-blue/30",
        tailscale: "bg-accent-purple/15 text-accent-purple border-accent-purple/30",
        default: "bg-bg-overlay text-text-secondary border-border-default",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, dot, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(badgeVariants({ variant }), className)}
        {...props}
      >
        {dot && (
          <div
            className={clsx(
              "w-1.5 h-1.5 rounded-full",
              variant === "connected" && "bg-accent-green",
              variant === "disconnected" && "bg-accent-red",
              variant === "connecting" && "bg-accent-amber animate-pulse",
              variant === "local" && "bg-accent-blue",
              variant === "tailscale" && "bg-accent-purple"
            )}
          />
        )}
        {children}
      </div>
    );
  }
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
