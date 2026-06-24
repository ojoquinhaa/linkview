import { CustomersTable } from "@/components/admin/customers-table";
import { listCustomers } from "@/server/admin/customers";

const fmtNum = (n: number) => n.toLocaleString("pt-BR");

export default async function AdminCustomersPage() {
  const customers = await listCustomers(200);

  return (
    <div className="flex flex-col">
      <div className="border-b border-line bg-paper px-6 py-6 sm:px-8">
        <h1 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em] text-ink">
          Clientes
        </h1>
        <p className="mt-1 text-[0.9rem] text-muted">
          {customers.length === 1
            ? "1 workspace na plataforma."
            : `${fmtNum(customers.length)} workspaces na plataforma.`}{" "}
          Clique em uma linha para gerenciar e auditar.
        </p>
      </div>

      <div className="px-6 py-7 sm:px-8">
        {customers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center text-[0.9rem] text-muted">
            Nenhum workspace ainda.
          </p>
        ) : (
          <CustomersTable customers={customers} />
        )}
      </div>
    </div>
  );
}
