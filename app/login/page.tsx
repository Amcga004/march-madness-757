import { getUser } from "@/lib/auth/authHelpers";
import { redirect } from "next/navigation";
import LoginClient from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const user = await getUser();
  if (user) redirect(searchParams.next ?? "/");

  return <LoginClient next={searchParams.next} error={searchParams.error} />;
}
