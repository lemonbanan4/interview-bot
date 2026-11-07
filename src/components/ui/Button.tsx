import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
};

const styles: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[#041512] hover:brightness-110 disabled:opacity-40",
  ghost:
    "border border-white/10 bg-white/[0.04] text-[var(--ink)] hover:border-[var(--accent)]/50 disabled:opacity-40",
  danger:
    "border border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-40",
};

export function Button({
  children,
  className = "",
  variant = "primary",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
