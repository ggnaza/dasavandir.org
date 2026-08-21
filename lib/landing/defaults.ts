import type { Block } from "./blocks";

/**
 * Default content for the public marketing site (ADR-0006).
 *
 * These reproduce today's hardcoded homepage / nav / footer EXACTLY, so making
 * the homepage DB-backed is a zero-visual-regression change. They are the
 * fallback the public renderer uses when no DB row exists yet, and the starting
 * content the admin editor loads the first time the `home` page is opened.
 *
 * Content mirrors `lib/i18n.ts` (en/hy) and `app/home-client.tsx`. Keep the two
 * in sync until the DB row is the operator's source of truth.
 */

export const DEFAULT_HOME_BLOCKS: Block[] = [
  {
    id: "home-hero",
    type: "hero",
    visible: true,
    data: {
      tag: { en: "Teach For Armenia", hy: "Teach For Armenia" },
      title: { en: "The learning platform", hy: "Ուսուցման հարթակ" },
      titleAccent: { en: "built for educators.", hy: "կառուցված մանկավարժների համար։" },
      desc: {
        en: "Dasavandir.org is an AI-powered learning management system built on Teach For Armenia's decade of experience transforming education across Armenia.",
        hy: "Dasavandir.org-ը արհեստական բանականությամբ աշխատող ուսուցման կառավարման համակարգ է, որ հիմնված է Teach For Armenia-ի տասնամյա փորձի վրա՝ Հայաստանում կրթությունը փոխակերպելու համար:",
      },
      primary: { label: { en: "Start for free →", hy: "Սկսել Անվճար →" }, action: "signup", href: "" },
      secondary: { label: { en: "Sign in", hy: "Մուտք" }, action: "login", href: "" },
      bgColor: "#323131",
      accentColor: "#EC5328",
    },
  },
  {
    id: "home-stats",
    type: "stats",
    visible: true,
    data: {
      bgColor: "#2085C7",
      items: [
        { number: { en: "10+", hy: "10+" }, label: { en: "Years of experience", hy: "Տարիների փորձ" } },
        { number: { en: "60K", hy: "60K" }, label: { en: "Students reached", hy: "Հասած աշակերտներ" } },
        { number: { en: "410", hy: "410" }, label: { en: "Schools across Armenia", hy: "Դպրոցներ Հայաստանում" } },
        { number: { en: "10", hy: "10" }, label: { en: "Regions covered", hy: "Ծածկված մարզեր" } },
      ],
    },
  },
  {
    id: "home-features",
    type: "features",
    visible: true,
    data: {
      title: { en: "EVERYTHING YOU NEED TO TEACH", hy: "ԱՅՆ ԱՄԵՆԸ, ԻՆՉ ԱՆՀՐԱԺԵՇՏ Է ԴԱՍԱՎԱՆԴԵԼՈՒ" },
      subtitle: {
        en: "Built for educators who want to focus on teaching, not technology.",
        hy: "Կառուցված է մանկավարժների համար, ովքեր ուզում են կենտրոնանալ դասավանդման, ոչ թե տեխնոլոգիայի վրա։",
      },
      bgColor: "#E8E7E5",
      cards: [
        { icon: "✦", color: "#EC5328", title: { en: "AI Course Builder", hy: "AI Դասընթացի Ստեղծող" }, desc: { en: "Paste your materials and AI generates a full course — lessons, summaries, and quizzes — in seconds.", hy: "Տեղադրեք ձեր նյութերը, և AI-ը վայրկյանների ընթացքում կստեղծի լիարժեք դասընթաց՝ դասեր, ամփոփումներ և թեստեր:" } },
        { icon: "🎓", color: "#2085C7", title: { en: "Rich Lesson Editor", hy: "Հարուստ Դասի Խմբագրիչ" }, desc: { en: "Create beautiful lessons with text, video, images, and file attachments. No coding needed.", hy: "Ստեղծեք գեղեցիկ դասեր տեքստով, տեսանյութով, նկարներով և ֆայլերի կցումներով: Ծրագրավորում չի պահանջվում:" } },
        { icon: "💬", color: "#EC5328", title: { en: "AI Tutor per Lesson", hy: "AI Դաստիարակ Յուրաքանչյուր Դասի Համար" }, desc: { en: "Every lesson has a built-in AI coach that answers questions, explains concepts, and quizzes learners.", hy: "Յուրաքանչյուր դաս ունի ներկառուցված AI դաստիարակ, որ պատասխանում է հարցերին, բացատրում է հասկացությունները և թեստեր անցկացնում:" } },
        { icon: "📝", color: "#2085C7", title: { en: "Assignments & AI Evaluation", hy: "Առաջադրանքներ և AI Գնահատում" }, desc: { en: "Set rubric-based assignments. AI evaluates submissions instantly. You review before releasing feedback.", hy: "Սահմանեք ռուբրիկ-հիմք առաջադրանքներ: AI-ը անմիջապես գնահատում է ներկայացումները: Դուք ստուգեք մինչև արձագանքն ուղարկելը:" } },
        { icon: "📊", color: "#EC5328", title: { en: "Progress Tracking", hy: "Առաջընթացի Հետևում" }, desc: { en: "Track every learner's progress across courses, lessons, quizzes, and assignments in one dashboard.", hy: "Հետևեք յուրաքանչյուր սովորողի առաջընթացը դասընթացների, դասերի, թեստերի և առաջադրանքների գծով՝ մեկ վահանակում:" } },
        { icon: "📱", color: "#2085C7", title: { en: "Mobile Friendly", hy: "Հարմար Շարժական Սարքերի Համար" }, desc: { en: "Works beautifully on phones, tablets, and computers. Learners can study anywhere, anytime.", hy: "Հիանալի աշխատում է հեռախոսներում, պլանշետներում և համակարգիչներում: Սովորողները կարող են սովորել ցանկացած վայրից, ցանկացած ժամանակ:" } },
      ],
    },
  },
  {
    id: "home-cta",
    type: "cta",
    visible: true,
    data: {
      title: { en: "Ready to transform learning?", hy: "Պատրա՞ստ եք փոխել ուսուցումը" },
      desc: {
        en: "Join educators across Armenia who are using Dasavandir to create better learning experiences.",
        hy: "Միացեք Հայաստանի մանկավարժներին, ովքեր Dasavandir-ն օգտագործում են ավելի լավ ուսուցողական փորձ ստեղծելու համար:",
      },
      button: { label: { en: "Create free account →", hy: "Ստեղծել անվճար հաշիվ →" }, action: "signup", href: "" },
      bgColor: "#EC5328",
    },
  },
];

export type MenuLocation = "nav" | "footer";

export interface MenuItem {
  id: string;
  location: MenuLocation;
  label: { en: string; hy: string };
  href: string;
  visible: boolean;
}

/** Default nav + footer links (the auth buttons + language toggle are fixed chrome, not menu items). */
export const DEFAULT_MENU: MenuItem[] = [
  { id: "nav-courses", location: "nav", label: { en: "Courses", hy: "Դասընթացներ" }, href: "/courses", visible: true },
  { id: "footer-terms", location: "footer", label: { en: "Terms of Service", hy: "Օգտագործման Պայմաններին" }, href: "/terms", visible: true },
  { id: "footer-privacy", location: "footer", label: { en: "Privacy Policy", hy: "Գաղտնիության Քաղաքականությանը" }, href: "/privacy", visible: true },
];
