export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</div>
  );
}
