import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { LoginForm } from "./login-form";

// Already-signed-in users have no business on the login screen; send them to
// the dashboard instead of letting them re-authenticate over a live session.
export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard/links");
  return <LoginForm />;
}
