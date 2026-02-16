import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-white/[0.06] text-text-primary hover:bg-white/[0.1] border border-white/[0.06] hover:border-white/[0.1]",
        primary:
          "bg-accent-blue text-white hover:bg-blue-600 shadow-[0_1px_12px_rgba(59,130,246,0.25)] hover:shadow-[0_1px_20px_rgba(59,130,246,0.35)]",
        danger:
          "bg-accent-red text-white hover:bg-red-600 shadow-[0_1px_12px_rgba(239,68,68,0.25)]",
        ghost:
          "text-text-secondary hover:text-text-primary hover:bg-white/[0.06]",
        success:
          "bg-accent-green text-white hover:bg-green-600 shadow-[0_1px_12px_rgba(34,197,94,0.25)]",
      },
      size: {
        sm: "h-7 px-2.5 text-[13px] gap-1.5",
        md: "h-8 px-3.5 text-[13px] gap-2",
        lg: "h-9 px-5 text-sm gap-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={clsx(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
