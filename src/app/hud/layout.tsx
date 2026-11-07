/**
 * Transparent shell for the Tauri desktop companion window.
 */
export const instant = false;

export default function HudLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen w-full bg-transparent p-0">{children}</div>;
}
