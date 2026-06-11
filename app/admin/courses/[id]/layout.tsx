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

  const peopleSubTabs = [
    { label: "Learners", href: `${base}/learners` },
    { label: "Moderators", href: `${base}/moderators` },
    ...(isAdmin ? [{ label: "Collaborators", href: `${base}/collaborators` }] : []),
  ];

  const isPeoplePage = peopleSubTabs.some((t) => pathname.startsWith(t.href));

  const aiCoachSubTabs = [
    { label: "Facilitation Chat", href: `${base}/ai-coach` },
    { label: "Coach Configuration", href: `${base}/ai-coach/configuration` },
  ];
  const isAiCoachPage = pathname.startsWith(`${base}/ai-coach`);

  // course_managers get a limited read-only view
  const tabs = isManager
    ? [
        { label: "Learners", href: `${base}/learners` },
        { label: "Groups", href: `${base}/groups` },
        { label: "Gradebook", href: `${base}/gradebook` },
        { label: "Progress", href: `${base}/progress` },
        { label: "Analytics", href: `${base}/analytics` },
        { label: "Announcements", href: `${base}/announcements` },
        { label: "AI Coach", href: `${base}/ai-coach` },
      ]
    : [
        { label: "Course", href: base },
        { label: "People", href: `${base}/learners`, isPeopleGroup: true },
        { label: "Groups", href: `${base}/groups` },
        { label: "Gradebook", href: `${base}/gradebook` },
        { label: "Progress", href: `${base}/progress` },
        { label: "Invitations", href: `${base}/invitations` },
        { label: "Announcements", href: `${base}/announcements` },
        { label: "Question Bank", href: `${base}/question-bank` },
        { label: "Capstone", href: `${base}/capstone` },
        { label: "Analytics", href: `${base}/analytics` },
        { label: "AI Coach", href: `${base}/ai-coach` },
      ];

  return (
    <div>
      {/* Main tab bar */}
      <nav className="flex gap-1 border-b mb-0">
        {tabs.map((tab) => {
          const active = (tab as any).isPeopleGroup
            ? isPeoplePage
            : tab.href === base
            ? pathname === base
            : pathname.startsWith(tab.href);
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

      {/* People sub-tabs */}
      {!isManager && isPeoplePage && (
        <div className="flex gap-1 border-b bg-gray-50 px-2 mb-6">
          {peopleSubTabs.map((sub) => {
            const active = pathname.startsWith(sub.href);
            return (
              <Link
                key={sub.href}
                href={sub.href}
                className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-brand-500 text-brand-700"
                    : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* AI Coach sub-tabs */}
      {isAiCoachPage && (
        <div className="flex gap-1 border-b bg-gray-50 px-2 mb-6">
          {aiCoachSubTabs.map((sub) => {
            const active = sub.href === `${base}/ai-coach`
              ? pathname === sub.href
              : pathname.startsWith(sub.href);
            return (
              <Link
                key={sub.href}
                href={sub.href}
                className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? "border-brand-500 text-brand-700"
                    : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {sub.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Spacer when no sub-tabs shown */}
      {(isManager || (!isPeoplePage && !isAiCoachPage)) && <div className="mb-6" />}

      {children}
    </div>
  );
}
