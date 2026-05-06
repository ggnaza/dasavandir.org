"use client";

import { useState } from "react";

type AddUserModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddUserModal({ isOpen, onClose, onSuccess }: AddUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "learner",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          fullName: `${formData.firstName} ${formData.lastName}`.trim(),
          role: formData.role,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send invitation");
        return;
      }

      if (data.message) {
        setInfo(data.message);
        setLoading(false);
        onSuccess();
        return;
      }

      setFormData({ firstName: "", lastName: "", email: "", role: "learner" });
      onSuccess();
      onClose();
    } catch {
      setError("Error sending invitation");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-1">Invite User</h2>
        <p className="text-sm text-gray-500 mb-4">They'll receive an email to set their own password.</p>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
        {info && <div className="bg-blue-50 text-blue-700 p-3 rounded mb-4 text-sm">{info}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="border rounded px-3 py-2 text-sm"
            />
          </div>

          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
            className="w-full border rounded px-3 py-2 text-sm"
          />

          <select
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="learner">Learner</option>
            <option value="course_creator">Course Creator</option>
            <option value="admin">Admin</option>
          </select>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
            >
              {loading ? "Sending…" : "Send invitation"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
