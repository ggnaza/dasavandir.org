"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Cancel a pending invitation (a learner stuck in the "Invited" state who never
// created an account). The DELETE /api/invitations/invite route already exists
// and checks course ownership; this just exposes it in the learners list. To
// re-add, use the "Invite students" flow.
export function CancelInviteButton({ invitationId, name }: { invitationId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleCancel() {
    if (!confirm(`Cancel the invitation for ${name}? You can re-invite them anytime.`)) return;
    setBusy(true);
    const res = await fetch("/api/invitations/invite", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invitationId }),
    });
    if (!res.ok) {
      alert(`Could not cancel invitation: ${await res.text()}`);
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleCancel}
      disabled={busy}
      className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
      title="Cancel invitation"
    >
      {busy ? "Cancelling…" : "Cancel invite"}
    </button>
  );
}
