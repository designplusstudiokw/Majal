import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, isAdminToken } from "@/lib/security";

export async function isAdmin() {
  return isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}
