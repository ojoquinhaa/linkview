import { redirect } from "next/navigation";
import { getSession } from "@/server/session";
import { RegisterForm } from "./register-form";

// A signed-in user reaching the sign-up flow is almost always a stale tab or a
// back-button; send them to the dashboard rather than starting a second account.
export default async function RegisterPage() {
  if (await getSession()) redirect("/dashboard/links");
  return <RegisterForm />;
}
