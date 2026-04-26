"use client";

import { useState } from "react";

type DeleteUserDialogProps = {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function DeleteUserDialog({ userId, userName, isOpen, onClose, onSuccess }: DeleteUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete user");
        return;
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError("Error deleting user");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold text-red-600 mb-2">Delete User</h2>
        <p className="text-gray-600 mb-4">
          Are you sure you want to delete <span className="font-medium">{userName}</span>? This action cannot be undone.
        </p>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}

        <div className="flex gap-2 pt-4">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400 text-sm font-medium"
          >
            {loading ? "Deleting..." : "Delete User"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
