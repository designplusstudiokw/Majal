import { cookies } from "next/headers";
import { AdminLogin } from "@/components/AdminActions";
import { ADMIN_COOKIE, adminPassword, isAdminToken } from "@/lib/security";

/** Renders children only for a signed-in admin. Must sit inside <Suspense>. */
export default async function AdminGate({ children }: { children: React.ReactNode }) {
  // Read the cookie first: it makes this render per request. Without it the
  // env check below would be evaluated at build time and frozen into the page.
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!adminPassword()) {
    return <p className="py-10">Admin is disabled. Set ADMIN_PASSWORD to enable it.</p>;
  }
  if (!isAdminToken(token)) {
    return (
      <div className="mx-auto grid max-w-sm gap-4 py-16">
        <h1 className="text-2xl font-bold">Admin</h1>
        <AdminLogin />
      </div>
    );
  }
  return <>{children}</>;
}
