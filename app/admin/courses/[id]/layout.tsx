"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function CourseAdminLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const pathname = usePathname();
  const base = `/admin/courses/${params.id}`;
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    fetch("/api/admin/me").then((r) => r.json()).then((d) => setRole(d.role ?? "")).catch(() => {});
  }, []);

  const isAdmin = role === "admin";
  const isManager = role === "course_manager";

  // course_managers get a limited read-only view — no course editing, lesson management, or admin tools
  const tabs = isManager
    ? [
        { label: "Students", href: `${base}/learners` },
        { label: "Groups", href: `${base}/groups` },
        { label: "Gradebook", href: `${base}/gradebook` },
        { label: "Progress", href: `${base}/progress` },
        { label: "Analytics", href: `${base}/analytics` },
        { label: "Announcements", href: `${base}/announcements` },
        { label: "AI Coach", href: `${base}/ai-coach` },
      ]
    : [
        { label: "Course", href: base },
        { label: "Students", href: `${base}/learners` },
        { label: "Groups", href: `${base}/groups` },
        { label: "Gradebook", href: `${base}/gradebook` },
        { label: "Progress", href: `${base}/progress` },
        { label: "Invitations", href: `${base}/invitations` },
        ...(isAdmin ? [{ label: "Collaborators", href: `${base}/collaborators` }] : []),
        { label: "Moderators", href: `${base}/moderators` },
        { label: "Announcements", href: `${base}/announcements` },
        { label: "Question Bank", href: `${base}/question-bank` },
        { label: "Capstone", href: `${base}/capstone` },
        { label: "Analytics", href: `${base}/analytics` },
        { label: "AI Coach", href: `${base}/ai-coach` },
      ];

  return (
    <div>
      <nav className="flex gap-1 border-b mb-6">
        {tabs.map((tab) => {
          const active = tab.href === base ? pathname === base : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
