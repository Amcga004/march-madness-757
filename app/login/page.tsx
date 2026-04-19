import { getUser } from "@/lib/auth/authHelpers";
import { redirect } from "next/navigation";
import LoginClient from "./LoginClient";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getUser();
  if (user) redirect(params.next ?? "/");
  return <LoginClient next={params.next} error={params.error} />;
}
