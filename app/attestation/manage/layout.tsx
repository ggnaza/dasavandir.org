import { redirect } from "next/navigation";
import { getAttestationUser } from "@/lib/attestation/server";

export const dynamic = "force-dynamic";

/** Test building and results are staff-only: platform admins and attestation managers. */
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const user = await getAttestationUser();
  if (!user?.isManager) redirect("/attestation");
  return <>{children}</>;
}
