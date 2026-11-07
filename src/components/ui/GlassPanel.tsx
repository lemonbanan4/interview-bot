import type { HTMLAttributes, ReactNode } from "react";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  glow?: boolean;
};

export function GlassPanel({
  children,
  className = "",
  glow = false,
  ...rest
}: GlassPanelProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl ${
        glow ? "shadow-[0_0_40px_var(--glow),inset_0_1px_0_rgba(255,255,255,0.06)]" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
