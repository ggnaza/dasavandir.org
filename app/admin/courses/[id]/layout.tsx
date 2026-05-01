"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CourseAdminLayout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const pathname = usePathname();
  const base = `/admin/courses/${params.id}`;

  const tabs = [
    { label: "Course", href: base },
    { label: "Students", href: `${base}/learners` },
    { label: "Gradebook", href: `${base}/gradebook` },
    { label: "Invitations", href: `${base}/invitations` },
    { label: "Moderators", href: `${base}/moderators` },
    { label: "Question Bank", href: `${base}/question-bank` },
    { label: "Capstone", href: `${base}/capstone` },
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
