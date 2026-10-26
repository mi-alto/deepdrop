import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  adminPath as configuredPath,
} from "@/lib/security";
import { ADMIN_COOKIE, adminSession } from "@/lib/http";
import AdminPanel from "@/components/AdminPanel";
export const dynamic = "force-dynamic";
export default async function Admin({
  params,
}: {
  params: Promise<{ adminPath: string }>;
}) {
  const { adminPath } = await params;
  if (`/${adminPath}` !== configuredPath()) notFound();
  const authenticated = !!(await adminSession(
    (await cookies()).get(ADMIN_COOKIE)?.value,
  ));
  return <AdminPanel base={`/${adminPath}`} initialAuth={authenticated} />;
}
