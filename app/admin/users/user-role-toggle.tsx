"use client";

import { useState } from "react";

type UserRoleToggleProps = {
  userId: string;
  currentRole: string;
  onUpdate?: () => void;
};

export function UserRoleToggle({ userId, currentRole, onUpdate }: UserRoleToggleProps) {
  const [role, setRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);

  const roles = ["admin", "course_creator", "learner"];

  const handleRoleChange = async (newRole: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (res.ok) {
        setRole(newRole);
        onUpdate?.();
      } else {
        alert("Failed to update role");
      }
    } catch (err) {
      alert("Error updating role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <select
      value={role}
      onChange={(e) => handleRoleChange(e.target.value)}
      disabled={loading}
      className="text-sm px-2 py-1 border rounded"
    >
      {roles.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
