export type Lang = "en" | "hy";

export function getLang(cookieValue?: string | null): Lang {
  return cookieValue === "hy" ? "hy" : "en";
}

export const translations = {
  en: {
    // Nav
    courses: "Courses",
    signIn: "Sign in",
    signOut: "Sign out",
    getStarted: "Get started",
    myCourses: "My Courses",
    myProgress: "My Progress",
    browse: "Browse",
    notifications: "Notifications",
    discussions: "Discussions",
    capstone: "Capstone project",

    // Homepage hero
    heroTag: "Teach For Armenia",
    heroTitle: "The learning platform",
    heroTitleAccent: "built for educators.",
    heroDesc:
      "Dasavandir.org is an AI-powered learning management system built on Teach For Armenia's decade of experience transforming education across Armenia.",
    startFree: "Start for free →",

    // Stats
    stat1Number: "10+",
    stat1Label: "Years of experience",
    stat2Number: "60K",
    stat2Label: "Students reached",
    stat3Number: "410",
    stat3Label: "Schools across Armenia",
    stat4Number: "10",
    stat4Label: "Regions covered",

    // Features
    featuresTitle: "EVERYTHING YOU NEED TO TEACH",
    featuresSubtitle: "Built for educators who want to focus on teaching, not technology.",
    features: [
      { icon: "✦", title: "AI Course Builder", desc: "Paste your materials and AI generates a full course — lessons, summaries, and quizzes — in seconds.", color: "#EC5328" },
      { icon: "🎓", title: "Rich Lesson Editor", desc: "Create beautiful lessons with text, video, images, and file attachments. No coding needed.", color: "#2085C7" },
      { icon: "💬", title: "AI Tutor per Lesson", desc: "Every lesson has a built-in AI coach that answers questions, explains concepts, and quizzes learners.", color: "#EC5328" },
      { icon: "📝", title: "Assignments & AI Evaluation", desc: "Set rubric-based assignments. AI evaluates submissions instantly. You review before releasing feedback.", color: "#2085C7" },
      { icon: "📊", title: "Progress Tracking", desc: "Track every learner's progress across courses, lessons, quizzes, and assignments in one dashboard.", color: "#EC5328" },
      { icon: "📱", title: "Mobile Friendly", desc: "Works beautifully on phones, tablets, and computers. Learners can study anywhere, anytime.", color: "#2085C7" },
    ],

    // Courses
    exploreCoursesTitle: "Explore Courses",
    exploreCoursesSub: "Start learning with courses designed by Armenian educators.",
    seeAll: "See all →",
    browseCourses: "Browse Courses",
    browseCoursesSub: "Explore courses built by educators at Teach For Armenia.",
    noCourses: "No courses found.",
    viewCourse: "View course →",

    // Filters
    filterAll: "All",
    filterFree: "Free",
    filterPaid: "Paid",
    filterArmenian: "Armenian",
    filterEnglish: "English",
    free: "Free",
    paid: "Paid",

    // CTA
    ctaTitle: "Ready to transform learning?",
    ctaDesc: "Join educators across Armenia who are using Dasavandir to create better learning experiences.",
    createAccount: "Create free account →",

    // Footer
    builtBy: "Built by Teach For Armenia",
    allRights: "All rights reserved.",

    // Course language badges
    languageArmenian: "Armenian",
    languageEnglish: "English",

    // Auth
    signUp: "Sign up",
    continueWithGoogle: "Continue with Google",
    redirecting: "Redirecting…",
    or: "or",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Password",
    passwordPlaceholder: "••••••••",
    passwordMinPlaceholder: "Min. 8 characters",
    nameLabel: "Full name",
    namePlaceholder: "Your name",
    loginBtn: "Sign in",
    signingIn: "Signing in…",
    signupBtn: "Create account",
    creatingAccount: "Creating account…",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",

    // Learner dashboard
    enrolledEmpty: "You haven't enrolled in any courses yet.",
    browseCoursesLink: "Browse courses →",
    lessonsCount: (done: number, total: number) => `${done}/${total} lessons`,
    complete: "Complete ✓",
    searchPlaceholder: "Search my courses…",
    noSearchResults: (q: string) => `No courses match "${q}".`,
  },

  hy: {
    // Nav
    courses: "Դասընթացներ",
    signIn: "Մուտք",
    signOut: "Ելք",
    getStarted: "Սկսել",
    myCourses: "Իմ Դասընթացները",
    myProgress: "Իմ Առաջընթացը",
    browse: "Դիտել",
    notifications: "Ծանուցումներ",
    discussions: "Քննարկումներ",
    capstone: "Ավարտական Աշխատանք",

    // Homepage hero
    heroTag: "Teach For Armenia",
    heroTitle: "Ուսուցման հարթակ",
    heroTitleAccent: "կառուցված մանկավարժների համար։",
    heroDesc:
      "Dasavandir.org-ը արհեստական բանականությամբ աշխատող ուսուցման կառավարման համակարգ է, որ հիմնված է Teach For Armenia-ի տասնամյա փորձի վրա՝ Հայաստանում կրթությունը փոխակերպելու համար:",
    startFree: "Սկսել Անվճար →",

    // Stats
    stat1Number: "10+",
    stat1Label: "Տարիների փորձ",
    stat2Number: "60K",
    stat2Label: "Հասած աշակերտներ",
    stat3Number: "410",
    stat3Label: "Դպրոցներ Հայաստանում",
    stat4Number: "10",
    stat4Label: "Ծածկված մարզեր",

    // Features
    featuresTitle: "ԱՅՆ ԱՄԵՆԸ, ԻՆՉ ԱՆՀՐԱԺԵՇՏ Է ԴԱՍԱՎԱՆԴԵԼՈՒ",
    featuresSubtitle: "Կառուցված է մանկավարժների համար, ովքեր ուզում են կենտրոնանալ դասավանդման, ոչ թե տեխնոլոգիայի վրա։",
    features: [
      { icon: "✦", title: "AI Դասընթացի Ստեղծող", desc: "Տեղադրեք ձեր նյութերը, և AI-ը վայրկյանների ընթացքում կստեղծի լիարժեք դասընթաց՝ դասեր, ամփոփումներ և թեստեր:", color: "#EC5328" },
      { icon: "🎓", title: "Հարուստ Դասի Խմբագրիչ", desc: "Ստեղծեք գեղեցիկ դասեր տեքստով, տեսանյութով, նկարներով և ֆայլերի կցումներով: Ծրագրավորում չի պահանջվում:", color: "#2085C7" },
      { icon: "💬", title: "AI Դաստիարակ Յուրաքանչյուր Դասի Համար", desc: "Յուրաքանչյուր դաս ունի ներկառուցված AI դաստիարակ, որ պատասխանում է հարցերին, բացատրում է հասկացությունները և թեստեր անցկացնում:", color: "#EC5328" },
      { icon: "📝", title: "Առաջադրանքներ և AI Գնահատում", desc: "Սահմանեք ռուբրիկ-հիմք առաջադրանքներ: AI-ը անմիջապես գնահատում է ներկայացումները: Դուք ստուգեք մինչև արձագանքն ուղարկելը:", color: "#2085C7" },
      { icon: "📊", title: "Առաջընթացի Հետևում", desc: "Հետևեք յուրաքանչյուր սովորողի առաջընթացը դասընթացների, դասերի, թեստերի և առաջադրանքների գծով՝ մեկ վահանակում:", color: "#EC5328" },
      { icon: "📱", title: "Հարմար Շարժական Սարքերի Համար", desc: "Հիանալի աշխատում է հեռախոսներում, պլանշետներում և համակարգիչներում: Սովորողները կարող են սովորել ցանկացած վայրից, ցանկացած ժամանակ:", color: "#2085C7" },
    ],

    // Courses
    exploreCoursesTitle: "Ուսումնասիրեք Դասընթացները",
    exploreCoursesSub: "Սկսեք սովորել հայաստանյան մանկավարժների կողմից կազմված դասընթացներով:",
    seeAll: "Տեսնել բոլորը →",
    browseCourses: "Դասընթացների Դիտարկում",
    browseCoursesSub: "Ուսումնասիրեք Teach For Armenia-ի մանկավարժների կողմից կառուցված դասընթացները:",
    noCourses: "Դասընթացներ չեն գտնվել:",
    viewCourse: "Տեսնել դասընթացը →",

    // Filters
    filterAll: "Բոլորը",
    filterFree: "Անվճար",
    filterPaid: "Վճարովի",
    filterArmenian: "Հայերեն",
    filterEnglish: "Անգլերեն",
    free: "Անվճար",
    paid: "Վճարովի",

    // CTA
    ctaTitle: "Պատրա՞ստ եք փոխել ուսուցումը",
    ctaDesc: "Միացեք Հայաստանի մանկավարժներին, ովքեր Dasavandir-ն օգտագործում են ավելի լավ ուսուցողական փորձ ստեղծելու համար:",
    createAccount: "Ստեղծել անվճար հաշիվ →",

    // Footer
    builtBy: "Կառուցված Teach For Armenia-ի կողմից",
    allRights: "Բոլոր իրավունքները պաշտպանված են:",

    // Course language badges
    languageArmenian: "Հայերեն",
    languageEnglish: "Անգլերեն",

    // Auth
    signUp: "Գրանցվել",
    continueWithGoogle: "Շարունակել Google-ով",
    redirecting: "Վերահղում…",
    or: "կամ",
    emailLabel: "Էլ. հասցե",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Գաղտնաբառ",
    passwordPlaceholder: "••••••••",
    passwordMinPlaceholder: "Նվ. 8 նիշ",
    nameLabel: "Անուն և Ազգանուն",
    namePlaceholder: "Ձեր անունը",
    loginBtn: "Մուտք",
    signingIn: "Մուտք գործում…",
    signupBtn: "Ստեղծել Հաշիվ",
    creatingAccount: "Ստեղծվում է հաշիվ…",
    noAccount: "Հաշիվ չունե՞ք",
    haveAccount: "Արդեն ունե՞ք հաշիվ",

    // Learner dashboard
    enrolledEmpty: "Դուք դեռ ոչ մի դասընթացի չեք գրանցվել:",
    browseCoursesLink: "Դիտել Դասընթացները →",
    lessonsCount: (done: number, total: number) => `${done}/${total} դաս`,
    complete: "Ավարտված ✓",
    searchPlaceholder: "Որոնել իմ դասընթացները…",
    noSearchResults: (q: string) => `Դասընթացներ չեն գտնվել "${q}"-ի համար:`,
  },
} as const;

export type Translations = typeof translations.en;
