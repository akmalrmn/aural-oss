export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f6f8f5] px-4 py-12">
      <div className="absolute inset-x-0 top-0 h-48 bg-[#0e2148]" />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
