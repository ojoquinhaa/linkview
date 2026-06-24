import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/server/admin/guard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  return (
    <AdminShell user={{ name: admin.name, email: admin.email }}>
      {children}
    </AdminShell>
  );
}
