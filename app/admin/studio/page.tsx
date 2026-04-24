import Link from "next/link";

export const dynamic = "force-dynamic";

const tools = [
  {
    icon: "✦",
    iconBg: "bg-brand-50",
    iconColor: "text-brand-600",
    title: "AI Course Builder",
    description:
      "Paste notes, upload a PDF, or pick files from Google Drive — AI turns your material into a full course with lessons, content, and quizzes in ~30 seconds.",
    cta: "Start building →",
    href: "/admin/ai-builder",
    badge: "Recommended",
    badgeColor: "bg-brand-100 text-brand-700",
  },
  {
    icon: "✏️",
    iconBg: "bg-gray-100",
    iconColor: "",
    title: "Manual Course",
    description:
      "Start with a blank course and write each lesson yourself. Best when you already know exactly how you want to structure the content.",
    cta: "Create manually →",
    href: "/admin/courses/new",
    badge: null,
    badgeColor: "",
  },
  {
    icon: "🎧",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    title: "Audio Narration",
    description:
      "Generate an AI voice narration for any lesson. Open a lesson in your course, scroll to the Audio section, and click Generate. Learners hear it above the lesson text.",
    cta: "Go to my courses →",
    href: "/admin/courses",
    badge: "Per lesson",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    icon: "📁",
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    title: "Google Drive Import",
    description:
      "Connect your Google Drive and select Docs, Slides, or text files directly — no copy-pasting needed. Works inside the AI Course Builder.",
    cta: "Open AI Builder →",
    href: "/admin/ai-builder",
    badge: null,
    badgeColor: "",
  },
];

export default function StudioPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Dashboard</Link>
        <h1 className="text-2xl font-bold mt-2">Creation Studio</h1>
        <p className="text-gray-500 text-sm mt-1">Choose how you want to create your next course or lesson.</p>
      </div>

      <div className="grid gap-4">
        {tools.map((tool) => (
          <div key={tool.title} className="bg-white border rounded-xl p-6 flex gap-5 items-start hover:shadow-sm transition">
            <div className={`w-12 h-12 rounded-xl ${tool.iconBg} flex items-center justify-center text-2xl shrink-0`}>
              <span className={tool.iconColor}>{tool.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-semibold text-gray-900">{tool.title}</h2>
                {tool.badge && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tool.badgeColor}`}>
                    {tool.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-4">{tool.description}</p>
              <Link
                href={tool.href}
                className="text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                {tool.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
