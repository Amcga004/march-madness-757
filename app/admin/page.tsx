import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPanel from "@/app/components/AdminPanel";

const ADMIN_EMAIL = "amacBFS@gmail.com";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  if ((user.email ?? "").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <h2 className="text-3xl font-bold">Access Denied</h2>
          <p className="mt-3 text-gray-600">
            This admin area is restricted to the commissioner account.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Signed in as: {user.email}
          </p>
        </div>
      </div>
    );
  }

  return <AdminPanel />;
}