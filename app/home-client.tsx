"use client";
import { useState } from "react";
import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { AuthModal } from "@/components/auth-modal";
import type { Lang } from "@/lib/i18n";
import { translations } from "@/lib/i18n";

type Course = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_paid: boolean;
  price_amd: number | null;
  language: string;
};

type ModalTab = "login" | "signup";

interface Props {
  courses: Course[];
  lang: Lang;
}

export function HomeClient({ courses, lang }: Props) {
  const T = translations[lang];
  const [modal, setModal] = useState<ModalTab | null>(null);

  return (
    <div className="min-h-screen bg-white font-sans">

      {modal && (
        <AuthModal defaultTab={modal} onClose={() => setModal(null)} lang={lang} />
      )}

      {/* Nav */}
      <nav className="fixed top-0 w-full z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: "#EC5328" }}>Դasavandir</span>
            <span className="text-xs text-gray-400 mt-1">.org</span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle current={lang} />
            <Link href="/courses" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              {T.courses}
            </Link>
            <button
              onClick={() => setModal("login")}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              {T.signIn}
            </button>
            <button
              onClick={() => setModal("signup")}
              className="text-sm text-white px-4 py-2 rounded-lg font-medium"
              style={{ backgroundColor: "#EC5328" }}
            >
              {T.getStarted}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 relative overflow-hidden" style={{ backgroundColor: "#323131" }}>
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-10" style={{ backgroundColor: "#EC5328" }} />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full opacity-10" style={{ backgroundColor: "#2085C7" }} />
        <div className="absolute top-20 right-1/3 w-48 h-48 rounded-full opacity-5" style={{ backgroundColor: "#EFA159" }} />

        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <div className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-6" style={{ backgroundColor: "#EC5328", color: "white" }}>
            {T.heroTag}
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-white leading-tight mb-6">
            {T.heroTitle}<br />
            <span style={{ color: "#EC5328" }}>{T.heroTitleAccent}</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mb-10 leading-relaxed">
            {T.heroDesc}
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => setModal("signup")}
              className="px-7 py-3 rounded-lg text-white font-semibold text-sm"
              style={{ backgroundColor: "#EC5328" }}
            >
              {T.startFree}
            </button>
            <button
              onClick={() => setModal("login")}
              className="px-7 py-3 rounded-lg font-semibold text-sm border border-white/20 text-white hover:bg-white/10"
            >
              {T.signIn}
            </button>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ backgroundColor: "#2085C7" }}>
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { number: T.stat1Number, label: T.stat1Label },
            { number: T.stat2Number, label: T.stat2Label },
            { number: T.stat3Number, label: T.stat3Label },
            { number: T.stat4Number, label: T.stat4Label },
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
            {T.featuresTitle}
          </h2>
          <p className="text-center text-gray-500 mb-12 text-sm">{T.featuresSubtitle}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {T.features.map((f) => (
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

      {/* Courses section */}
      {courses.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-bold" style={{ color: "#323131" }}>{T.exploreCoursesTitle}</h2>
              <Link href="/courses" className="text-sm font-semibold hover:underline" style={{ color: "#EC5328" }}>
                {T.seeAll}
              </Link>
            </div>
            <p className="text-gray-500 text-sm mb-10">{T.exploreCoursesSub}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => setModal("login")}
                  className="border rounded-2xl overflow-hidden hover:shadow-md transition flex flex-col bg-white cursor-pointer"
                >
                  {course.cover_image_url ? (
                    <img src={course.cover_image_url} alt={course.title} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 flex items-center justify-center text-4xl" style={{ backgroundColor: "#323131" }}>🎓</div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 text-sm leading-snug">{course.title}</h3>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {course.is_paid ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            {course.price_amd ? `${course.price_amd.toLocaleString()} ֏` : T.paid}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">{T.free}</span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {course.language === "en" ? T.languageEnglish : T.languageArmenian}
                        </span>
                      </div>
                    </div>
                    {course.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{course.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 relative overflow-hidden" style={{ backgroundColor: "#EC5328" }}>
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10 bg-white" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-10 bg-white" />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl font-bold text-white mb-4">{T.ctaTitle}</h2>
          <p className="text-orange-100 mb-8 text-lg">{T.ctaDesc}</p>
          <button
            onClick={() => setModal("signup")}
            className="inline-block bg-white px-8 py-3 rounded-lg font-bold text-sm"
            style={{ color: "#EC5328" }}
          >
            {T.createAccount}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: "#323131" }}>
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="text-xl font-bold" style={{ color: "#EC5328" }}>Dasavandir.org</span>
            <p className="text-gray-400 text-xs mt-1">{T.builtBy}</p>
          </div>
          <div className="flex gap-6 text-sm text-gray-400">
            <button onClick={() => setModal("login")} className="hover:text-white">{T.signIn}</button>
            <button onClick={() => setModal("signup")} className="hover:text-white">{T.getStarted}</button>
            <a href={`/terms?lang=${lang}`} className="hover:text-white">{T.termsLink}</a>
            <a href={`/privacy?lang=${lang}`} className="hover:text-white">{T.privacyLink}</a>
          </div>
          <p className="text-gray-500 text-xs">© {new Date().getFullYear()} Teach For Armenia. {T.allRights}</p>
        </div>
      </footer>

    </div>
  );
}
