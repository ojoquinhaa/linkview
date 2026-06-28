import { AccountMenu } from "@/components/account-menu";
import { Wordmark } from "@/components/wordmark";

/**
 * Header for signed-in pages outside the dashboard (the /assinar flow): the
 * wordmark on the left, the account menu on the right. Keeps a consistent "you
 * are signed in as…" affordance across checkout so the user never wonders which
 * account they're paying with, and can switch or leave from any step.
 */
export function PublicHeader({
  user,
  canAccessDashboard = false,
}: {
  user: { name: string; email: string };
  canAccessDashboard?: boolean;
}) {
  return (
    <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-5 sm:px-10">
      <Wordmark size="md" />
      <AccountMenu
        name={user.name}
        email={user.email}
        canAccessDashboard={canAccessDashboard}
      />
    </header>
  );
}
