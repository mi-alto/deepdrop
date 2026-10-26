import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  adminPath as configuredPath,
  adminVersion,
  readSession,
} from "@/lib/security";
import { ADMIN_COOKIE } from "@/lib/http";
import AdminPanel from "@/components/AdminPanel";
export const dynamic = "force-dynamic";
export default async function Admin({
  params,
}: {
  params: Promise<{ adminPath: string }>;
}) {
  const { adminPath } = await params;
  if (`/${adminPath}` !== configuredPath()) notFound();
  const authenticated = !!readSession(
    (await cookies()).get(ADMIN_COOKIE)?.value,
    { kind: "admin", version: adminVersion() },
  );
  return <AdminPanel base={`/${adminPath}`} initialAuth={authenticated} />;
}
