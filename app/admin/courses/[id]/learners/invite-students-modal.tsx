"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Mode = "single" | "bulk";

interface Student {
  email: string;
  firstName: string;
  lastName: string;
}

export function InviteStudentsButton({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 text-sm font-medium"
      >
        Invite students
      </button>
      {open && <InviteModal courseId={courseId} onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteModal({ courseId, onClose }: { courseId: string; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("single");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ invited?: number; error?: string } | null>(null);

  // Single mode state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Bulk mode state
  const [bulkInput, setBulkInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setLoading(true);
    setResult(null);

    let students: Student[] = [];

    if (mode === "single") {
      if (!email.trim()) {
        setResult({ error: "Email is required." });
        setLoading(false);
        return;
      }
      students = [{ email: email.trim().toLowerCase(), firstName: firstName.trim(), lastName: lastName.trim() }];
    } else {
      // Parse bulk: each line can be "email" or "first,last,email" or "first last <email>"
      const lines = bulkInput.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length === 3) {
          students.push({ firstName: parts[0], lastName: parts[1], email: parts[2].toLowerCase() });
        } else if (parts.length === 1) {
          students.push({ firstName: "", lastName: "", email: parts[0].toLowerCase() });
        } else {
          students.push({ firstName: parts[0], lastName: "", email: parts[parts.length - 1].toLowerCase() });
        }
      }
      if (students.length === 0) {
        setResult({ error: "No valid entries found." });
        setLoading(false);
        return;
      }
    }

    const res = await fetch("/api/invitations/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, students }),
    });

    if (res.ok) {
      const data = await res.json();
      setResult({ invited: data.invited });
      setFirstName(""); setLastName(""); setEmail(""); setBulkInput("");
      router.refresh();
    } else {
      setResult({ error: await res.text() });
    }
    setLoading(false);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBulkInput((ev.target?.result as string) ?? "");
    reader.readAsText(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">Invite students</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5">
          {(["single", "bulk"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResult(null); }}
              className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
                mode === m ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {m === "single" ? "One student" : "Import list"}
            </button>
          ))}
        </div>

        {mode === "single" ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Anna"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Petrosyan"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email address <span className="text-red-500">*</span></label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="anna@example.com"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              One per line. Format: <code className="bg-gray-100 px-1 rounded">email</code> or <code className="bg-gray-100 px-1 rounded">FirstName,LastName,email</code>
            </p>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              rows={6}
              placeholder={"anna@example.com\nArmen,Harutyunyan,armen@example.com"}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs text-brand-600 hover:underline"
              >
                Upload CSV file
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
            </div>
          </div>
        )}

        {result?.invited !== undefined && (
          <p className="mt-3 text-sm text-green-600 font-medium">
            ✓ {result.invited} invitation{result.invited !== 1 ? "s" : ""} sent.
          </p>
        )}
        {result?.error && (
          <p className="mt-3 text-sm text-red-600">{result.error}</p>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-gray-50">Cancel</button>
          <button
            onClick={submit}
            disabled={loading}
            className="bg-brand-600 text-white px-5 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50 text-sm font-medium"
          >
            {loading ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </div>
    </div>
  );
}
