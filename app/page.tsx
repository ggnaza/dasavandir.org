import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    redirect(profile?.role === "admin" ? "/admin" : "/learn");
  }

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: "#EC5328" }}>Դasavandir</span>
            <span className="text-xs text-gray-400 mt-1">.org</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="text-sm text-white px-4 py-2 rounded-lg font-medium"
              style={{ backgroundColor: "#EC5328" }}
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 relative overflow-hidden" style={{ backgroundColor: "#323131" }}>
        {/* Decorative circles — TFA motif */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: "#EC5328" }} />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-10" style={{ backgroundColor: "#2085C7" }} />
        <div className="absolute top-20 right-1/3 w-48 h-48 rounded-full opacity-5" style={{ backgroundColor: "#EFA159" }} />

        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-6" style={{ backgroundColor: "#EC5328", color: "white" }}>
            Teach For Armenia
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-6">
            The learning platform<br />
            <span style={{ color: "#EC5328" }}>built for educators.</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mb-10 leading-relaxed">
            Dasavandir.org is an AI-powered learning management system built on Teach For Armenia's decade of experience transforming education across Armenia. Create courses, track progress, and let AI support every learner.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/auth/signup"
              className="px-7 py-3 rounded-lg text-white font-semibold text-sm"
              style={{ backgroundColor: "#EC5328" }}
            >
              Start for free →
            </Link>
            <Link
              href="/auth/login"
              className="px-7 py-3 rounded-lg font-semibold text-sm border border-white/20 text-white hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ backgroundColor: "#2085C7" }}>
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { number: "10+", label: "Years of experience" },
            { number: "60K", label: "Students reached" },
            { number: "410", label: "Schools across Armenia" },
            { number: "10", label: "Regions covered" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-bold text-white">{s.number}</p>
              <p className="text-sm text-blue-100 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20" style={{ backgroundColor: "#E8E7E5" }}>
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-2" style={{ color: "#323131" }}>
            EVERYTHING YOU NEED TO TEACH
          </h2>
          <p className="text-center text-gray-500 mb-12 text-sm">Built for educators who want to focus on teaching, not technology.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "✦",
                title: "AI Course Builder",
                desc: "Paste your materials and AI generates a full course — lessons, summaries, and quizzes — in seconds.",
                color: "#EC5328",
              },
              {
                icon: "🎓",
                title: "Rich Lesson Editor",
                desc: "Create beautiful lessons with text, video, images, and file attachments. No coding needed.",
                color: "#2085C7",
              },
              {
                icon: "💬",
                title: "AI Tutor per Lesson",
                desc: "Every lesson has a built-in AI coach that answers questions, explains concepts, and quizzes learners.",
                color: "#EC5328",
              },
              {
                icon: "📝",
                title: "Assignments & AI Evaluation",
                desc: "Set rubric-based assignments. AI evaluates submissions instantly. You review before releasing feedback.",
                color: "#2085C7",
              },
              {
                icon: "📊",
                title: "Progress Tracking",
                desc: "Track every learner's progress across courses, lessons, quizzes, and assignments in one dashboard.",
                color: "#EC5328",
              },
              {
                icon: "📱",
                title: "Mobile Friendly",
                desc: "Works beautifully on phones, tablets, and computers. Learners can study anywhere, anytime.",
                color: "#2085C7",
              },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg mb-4" style={{ backgroundColor: f.color }}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="py-20 relative overflow-hidden" style={{ backgroundColor: "#EC5328" }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-10 bg-white" />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to transform learning?
          </h2>
          <p className="text-orange-100 mb-8 text-lg">
            Join educators across Armenia who are using Dasavandir to create better learning experiences.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block bg-white px-8 py-3 rounded-lg font-bold text-sm"
            style={{ color: "#EC5328" }}
          >
            Create free account →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: "#323131" }}>
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xl font-bold" style={{ color: "#EC5328" }}>Dasavandir.org</span>
            <p className="text-gray-400 text-xs mt-1">Built by Teach For Armenia</p>
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <Link href="/auth/login" className="hover:text-white">Sign in</Link>
            <Link href="/auth/signup" className="hover:text-white">Sign up</Link>
          </div>
          <p className="text-gray-500 text-xs">© {new Date().getFullYear()} Teach For Armenia. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
