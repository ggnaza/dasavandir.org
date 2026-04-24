"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NavProps = {
  role: "admin" | "learner";
  userName?: string;
};

export function Nav({ role, userName }: NavProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  const links =
    role === "admin"
      ? [
          { href: "/admin", label: "Dashboard" },
          { href: "/admin/courses", label: "Courses" },
          { href: "/admin/ai-builder", label: "✦ AI Builder" },
          { href: "/admin/submissions", label: "Submissions" },
          { href: "/admin/capstone-submissions", label: "Capstones" },
          { href: "/admin/analytics", label: "Analytics" },
        ]
      : [
          { href: "/learn", label: "My Courses" },
          { href: "/learn/progress", label: "My Progress" },
          { href: "/courses", label: "Browse" },
        ];

  return (
    <nav className="bg-white border-b px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-bold text-brand-600">Dasavandir</Link>
        <div className="hidden sm:flex gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-gray-600 hover:text-gray-900">
              {l.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {userName && <span className="text-gray-500 hidden sm:inline">{userName}</span>}
        <button onClick={handleSignOut} className="text-gray-600 hover:text-gray-900">
          Sign out
        </button>
      </div>
    </nav>
  );
}
