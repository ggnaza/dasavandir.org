"use client";
import { useState } from "react";
import Link from "next/link";

const LAST_UPDATED = "May 6, 2026";
const LAST_UPDATED_HY = "Մայիս 6, 2026";

export default function PrivacyPage() {
  const [lang, setLang] = useState<"en" | "hy">("en");

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-brand-600 hover:underline text-sm font-medium">
            ← {lang === "en" ? "Back to home" : "Վերադառնալ"}
          </Link>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setLang("en")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition ${lang === "en" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              English
            </button>
            <button
              onClick={() => setLang("hy")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition ${lang === "hy" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              Հայերեն
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {lang === "en" ? <PrivacyEN /> : <PrivacyHY />}
      </div>
    </div>
  );
}

function PrivacyEN() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: {LAST_UPDATED}</p>

      <p>
        Dasavandir.org (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is operated by{" "}
        <strong>Teach For Armenia</strong> (Unified Register No. 282.110.930088), a nonprofit
        organization registered in the Republic of Armenia. We are committed to protecting the
        privacy and personal data of everyone who uses our learning platform.
      </p>
      <p>
        This Privacy Policy explains what personal data we collect, how we use it, with whom we
        share it, and what rights you have under applicable law, including the{" "}
        <strong>EU General Data Protection Regulation (GDPR)</strong> and Armenian data protection
        law.
      </p>

      <h2>1. Data We Collect</h2>
      <p>We collect personal data in the following categories:</p>
      <ul>
        <li>
          <strong>Account data:</strong> full name, email address, hashed password, and profile
          information you provide during registration.
        </li>
        <li>
          <strong>Learning data:</strong> course enrolments, lesson progress, quiz scores,
          assignment submissions, and AI coach chat history.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser type, device information, and pages
          visited (collected automatically via server logs and analytics).
        </li>
        <li>
          <strong>Communication data:</strong> messages you send through discussion boards or
          support channels.
        </li>
        <li>
          <strong>Google OAuth data:</strong> if you sign in with Google, we receive your name,
          email address, and profile picture from Google, subject to Google&apos;s own privacy
          policy.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> collect payment card numbers directly. We do not sell or rent
        your personal data to third parties.
      </p>

      <h2>2. How We Use Your Data</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-3 py-2 text-left">Purpose</th>
            <th className="border border-gray-200 px-3 py-2 text-left">Legal basis (GDPR)</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Provide the learning platform and authenticate your account", "Contract performance (Art. 6(1)(b))"],
            ["Personalise your learning experience and AI coaching responses", "Contract performance (Art. 6(1)(b))"],
            ["Measure and improve platform performance and features", "Legitimate interests (Art. 6(1)(f))"],
            ["Send transactional emails (account activation, password reset)", "Contract performance (Art. 6(1)(b))"],
            ["Comply with legal obligations", "Legal obligation (Art. 6(1)(c))"],
            ["Conduct anonymised research on educational outcomes", "Legitimate interests (Art. 6(1)(f))"],
          ].map(([purpose, basis]) => (
            <tr key={purpose} className="even:bg-gray-50">
              <td className="border border-gray-200 px-3 py-2">{purpose}</td>
              <td className="border border-gray-200 px-3 py-2 text-gray-600">{basis}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>3. AI Features and Third-Party Processors</h2>
      <p>
        Our AI Coach and AI Course Builder are powered by third-party AI providers. When you
        interact with these features, your input and relevant context may be sent to:
      </p>
      <ul>
        <li>
          <strong>Google (Gemini API)</strong> — for AI-generated lesson content and coaching
          responses. Google processes data as a data processor under a Data Processing Agreement.
        </li>
        <li>
          <strong>OpenAI</strong> — where applicable, for additional AI functionality. Your data is
          processed under OpenAI&apos;s data processing terms.
        </li>
      </ul>
      <p>
        We do not use your data to train third-party AI models unless you explicitly consent.
        AI-generated responses are supplementary and not a substitute for professional advice.
      </p>

      <h2>4. Infrastructure and Hosting</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication, and file storage (servers in the EU
          or US; Supabase is a data processor under a DPA).
        </li>
        <li>
          <strong>Vercel</strong> — web hosting and edge functions (servers worldwide; Vercel is a
          data processor under a DPA).
        </li>
        <li>
          <strong>Cloudflare</strong> — CAPTCHA (Turnstile) and DDoS protection.
        </li>
      </ul>
      <p>
        All processors are bound by contractual obligations to process your data only on our
        instructions and to maintain appropriate security measures.
      </p>

      <h2>5. International Data Transfers</h2>
      <p>
        Some processors are based outside the European Economic Area. Where such transfers occur,
        we ensure appropriate safeguards are in place, including Standard Contractual Clauses
        approved by the European Commission or reliance on adequacy decisions.
      </p>

      <h2>6. Data Retention</h2>
      <ul>
        <li>
          <strong>Active accounts:</strong> we retain your data for as long as your account is
          active.
        </li>
        <li>
          <strong>Deleted accounts:</strong> most personal data is deleted within 30 days of account
          deletion. Anonymised analytics data may be kept indefinitely.
        </li>
        <li>
          <strong>Legal obligations:</strong> certain records may be kept longer if required by law
          (e.g. tax records for 5 years).
        </li>
      </ul>

      <h2>7. Your Rights</h2>
      <p>
        Under GDPR and Armenian data protection law, you have the right to:
      </p>
      <ul>
        <li><strong>Access</strong> — request a copy of your personal data.</li>
        <li><strong>Rectification</strong> — correct inaccurate data.</li>
        <li><strong>Erasure</strong> — request deletion of your data (&ldquo;right to be forgotten&rdquo;).</li>
        <li><strong>Restriction</strong> — ask us to temporarily stop processing your data.</li>
        <li><strong>Portability</strong> — receive your data in a machine-readable format.</li>
        <li><strong>Objection</strong> — object to processing based on legitimate interests.</li>
        <li>
          <strong>Withdraw consent</strong> — where processing is based on consent, withdraw it at
          any time without affecting prior processing.
        </li>
      </ul>
      <p>
        To exercise any of these rights, email us at{" "}
        <a href="mailto:privacy@dasavandir.org">privacy@dasavandir.org</a>. We will respond within
        30 days. You also have the right to lodge a complaint with the relevant supervisory
        authority.
      </p>

      <h2>8. Cookies</h2>
      <p>We use the following cookies:</p>
      <ul>
        <li>
          <strong>Essential cookies:</strong> session tokens required for authentication and security.
          These cannot be disabled.
        </li>
        <li>
          <strong>Preference cookies:</strong> remember your language setting.
        </li>
        <li>
          <strong>Analytics cookies:</strong> anonymous usage data to improve the platform. You can
          opt out via your browser settings.
        </li>
      </ul>

      <h2>9. Children&apos;s Privacy</h2>
      <p>
        Dasavandir.org is intended for users aged <strong>16 and above</strong>. We do not
        knowingly collect personal data from children under 16. If you believe a child under 16 has
        created an account, please contact us immediately and we will delete the account.
      </p>
      <p>
        For learners between 16 and 18, parental or guardian consent may be required depending on
        your jurisdiction.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we make material changes, we will
        notify you by email or by a prominent notice on the platform at least 14 days before the
        changes take effect. Continued use of the platform after the effective date constitutes
        acceptance of the updated policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        For any privacy-related questions or requests:
      </p>
      <ul>
        <li>
          <strong>Teach For Armenia — Data Protection</strong>
        </li>
        <li>Email: <a href="mailto:privacy@dasavandir.org">privacy@dasavandir.org</a></li>
        <li>Address: Yerevan, Republic of Armenia</li>
      </ul>
    </article>
  );
}

function PrivacyHY() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Գաղտնիության Քաղաքականություն</h1>
      <p className="text-sm text-gray-500 mb-8">Վերջին թարմացում՝ {LAST_UPDATED_HY}</p>

      <p>
        Dasavandir.org-ը («մենք», «մեր» կամ «մեզ») շահագործում է{" "}
        <strong>Teach For Armenia</strong>-ն (Միասնական ռեգիստր՝ 282.110.930088)՝ Հայաստանի
        Հանրապետությունում գրանցված ոչ առևտրային կազմակերպություն։ Մենք հանձնառու ենք պաշտպանել
        մեր ուսուցման հարթակի բոլոր օգտատերերի գաղտնիությունն ու անձնական տվյալները։
      </p>
      <p>
        Սույն Գաղտնիության Քաղաքականությունը բացատրում է, թե ինչ անձնական տվյալներ ենք
        հավաքում, ինչպես ենք օգտագործում, ում հետ ենք կիսվում և ինչ իրավունքներ ունեք
        կիրառելի իրավունքի, այդ թվում՝ <strong>ԵՄ Ընդհանուր Տվյալների Պաշտպանության
        Կանոնակարգի (GDPR)</strong> և Հայաստանի տվյալների պաշտպանության օրենսդրության
        համաձայն։
      </p>

      <h2>1. Մեր Հավաքած Տվյալները</h2>
      <p>Մենք հավաքում ենք անձնական տվյալներ հետևյալ կատեգորիաներով.</p>
      <ul>
        <li>
          <strong>Հաշվի տվյալներ՝</strong> լրիվ անուն, էլ. հասցե, ծածկագրված գաղտնաբառ և
          գրանցման ժամանակ տրամադրված պրոֆիլի տեղեկատվություն։
        </li>
        <li>
          <strong>Ուսումնական տվյալներ՝</strong> դասընթացների գրանցումներ, դասերի
          առաջընթաց, թեստերի արդյունքներ, առաջադրանքների ներկայացումներ և AI
          դաստիարակի զրույցների պատմություն։
        </li>
        <li>
          <strong>Տեխնիկական տվյալներ՝</strong> IP հասցե, բրաուզերի տեսակ, սարքի
          տեղեկատվություն և այցելված էջեր (հավաքվում են ավտոմատ կերպով՝ սերվերի գրանցամատյանների
          և վերլուծության միջոցով)։
        </li>
        <li>
          <strong>Հաղորդակցության տվյալներ՝</strong> քննարկման ֆորումների կամ աջակցության
          ուղիների միջոցով ուղարկված հաղորդագրություններ։
        </li>
        <li>
          <strong>Google OAuth տվյալներ՝</strong> եթե մուտք եք գործում Google-ով, մենք
          Google-ից ստանում ենք ձեր անունը, էլ. հասցեն և պրոֆիլի նկարը՝ Google-ի սեփական
          գաղտնիության քաղաքականությանը համաձայն։
        </li>
      </ul>
      <p>
        Մենք <strong>չենք</strong> հավաքում վճարային քարտի համարներ անմիջականորեն։ Մենք
        չենք վաճառում կամ վարձակալություն տալ ձեր անձնական տվյալները երրորդ կողմերին։
      </p>

      <h2>2. Ձեր Տվյալների Օգտագործումը</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-200 px-3 py-2 text-left">Նպատակ</th>
            <th className="border border-gray-200 px-3 py-2 text-left">Իրավական հիմք (GDPR)</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Ուսուցման հարթակի տրամադրում և ձեր հաշվի նույնականացում", "Պայմանագրի կատարում (6(1)(b) հոդ.)"],
            ["Ուսուցման փորձի և AI դաստիարակի արձագանքների անհատականացում", "Պայմանագրի կատարում (6(1)(b) հոդ.)"],
            ["Հարթակի կատարողականի և հնարավորությունների չափում և բարելավում", "Օրինաչափ շահեր (6(1)(f) հոդ.)"],
            ["Գործարկման նամակների ուղարկում (հաշվի ակտիվացում, գաղտնաբառի վերականգնում)", "Պայմանագրի կատարում (6(1)(b) հոդ.)"],
            ["Իրավական պարտավորությունների կատարում", "Իրավական պարտավορություն (6(1)(c) հոդ.)"],
            ["Կրթական արդյունքների անանուն հետազոտություն", "Օրինաչափ շահեր (6(1)(f) հոդ.)"],
          ].map(([purpose, basis]) => (
            <tr key={purpose} className="even:bg-gray-50">
              <td className="border border-gray-200 px-3 py-2">{purpose}</td>
              <td className="border border-gray-200 px-3 py-2 text-gray-600">{basis}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>3. AI Գործառույթներ և Երրորդ Կողմի Մշակողներ</h2>
      <p>
        Մեր AI Դաստիարակը և AI Դասընթաց Ստեղծողն աշխատում են երրորդ կողմի AI
        մատակարարների կողմից։ Այս գործառույթներն օգտագործելիս ձեր մուտքի տվյալներն ու
        համապատասխան համատեքստը կարող են ուղարկվել.
      </p>
      <ul>
        <li>
          <strong>Google (Gemini API)</strong> — AI-ի կողմից ստեղծված դասի բովանդակության
          և դաստիարակչական արձագանքների համար։ Google-ը Տվյալների Մշակման Համաձայնագրի
          հիման վրա գործում է որպես տվյալների մշակող։
        </li>
        <li>
          <strong>OpenAI</strong> — կիրառելի դեպքում՝ լրացուցիչ AI գործառույթների համար։
          Ձեր տվյալները մշակվում են OpenAI-ի տվյալների մշակման պայմանների հիման վրա։
        </li>
      </ul>
      <p>
        Մենք ձեր տվյալները չենք օգտագործում երրորդ կողմի AI մոդելների ուսուցման համար,
        եթե դուք բացահայտ համաձայնություն չեք տվել։ AI-ի կողմից ստեղծված
        արձագանքները լրացուցիչ են և չեն փոխարինում մասնագիտական խորհրդին։
      </p>

      <h2>4. Ենթակառուցվածք և Հոսթինգ</h2>
      <ul>
        <li>
          <strong>Supabase</strong> — տվյալների բազա, նույնականացում և ֆայլերի
          պահպանություն (սերվերներ ԵՄ-ում կամ ԱՄՆ-ում)։
        </li>
        <li>
          <strong>Vercel</strong> — վեբ հոսթինգ և edge ֆունկցիաներ (սերվերներ ամբողջ
          աշխարհում)։
        </li>
        <li>
          <strong>Cloudflare</strong> — CAPTCHA (Turnstile) և DDoS պաշտպանություն։
        </li>
      </ul>
      <p>
        Բոլոր մշակողները պայմանագրային պարտավորություններ ունեն մշակել ձեր
        տվյալները միայն մեր հրահանգների համաձայն և ապահովել անվտանգության
        պատշաճ միջոցներ։
      </p>

      <h2>5. Տվյալների Միջազգային Փոխանցումներ</h2>
      <p>
        Որոշ մշակողներ գտնվում են Եվրոպական Տնտեսական Տարածքից դուրս։ Նման
        փոխանցումների դեպքում մենք ապահովում ենք պատշաճ երաշխիքների առկայությունը,
        այդ թվում՝ Եվրոպական Հանձնաժողովի կողմից հաստատված Ստանդարտ Պայմանագրային
        Կետերի կամ համապատասխանության որոշումների հիման վրա։
      </p>

      <h2>6. Տվյալների Պահպանություն</h2>
      <ul>
        <li>
          <strong>Ակտիվ հաշիվներ՝</strong> մենք պահում ենք ձեր տվյալները այնքան ժամանակ,
          քանի դեռ ձեր հաշիվն ակտիվ է։
        </li>
        <li>
          <strong>Ջնջված հաշիվներ՝</strong> հաշվի ջնջումից հետո 30 օրվա ընթացքում
          անձնական տվյալների մեծ մասը ջնջվում է։ Անանուն վերլուծական տվյալները
          կարող են պահպանվել անորոշ ժամկետով։
        </li>
        <li>
          <strong>Իրավական պարտավորություններ՝</strong> որոշ գրառումներ կարող են
          պահվել ավելի երկար, եթե դա պահանջվում է օրենքով (օր.՝ հարկային
          գրառումներ 5 տարի)։
        </li>
      </ul>

      <h2>7. Ձեր Իրավունքները</h2>
      <p>
        GDPR-ի և Հայաստանի տվյալների պաշտպանության օրենսդրության համաձայն՝ դուք
        ունեք հետևյալ իրավունքները.
      </p>
      <ul>
        <li><strong>Մուտք</strong> — պահանջել ձեր անձնական տվյալների պատճեն։</li>
        <li><strong>Ուղղում</strong> — ուղղել անճշտ տվյալները։</li>
        <li><strong>Ջնջում</strong> — պահանջել ձեր տվյալների ջնջումը («մոռացվելու իրավունք»)։</li>
        <li><strong>Սահմանափակում</strong> — խնդրել մեզ ժամանակավորապես դադարեցնել ձեր տվյալների մշակումը։</li>
        <li><strong>Տեղափոխելիություն</strong> — ստանալ ձեր տվյալները մեքենայով ընթերցվող ձևաչափով։</li>
        <li><strong>Առարկություն</strong> — առարկել օրինաչափ շահերի հիման վրա մշակմանը։</li>
        <li>
          <strong>Համաձայնության հետ կանչ</strong> — եթե մշակումը հիմնված է համաձայնության
          վրա, ցանկացած պահի հետ կանչել այն՝ առանց նախորդ մշակման վրա ազդելու։
        </li>
      </ul>
      <p>
        Այս իրավունքներից որևէ մեկն իրագործելու համար գրեք մեզ՝{" "}
        <a href="mailto:privacy@dasavandir.org">privacy@dasavandir.org</a>։ Մենք
        կպատասխանենք 30 օրվա ընթացքում։ Դուք նաև կարող եք բողոք ներկայացնել
        համապատասխան վերահսկիչ մարմնին։
      </p>

      <h2>8. Թխուկներ (Cookies)</h2>
      <p>Մենք օգտագործում ենք հետևյալ թխուկները.</p>
      <ul>
        <li>
          <strong>Էական թխուկներ՝</strong> նույնականացման և անվտանգության համար
          անհրաժեշտ session token-ներ։ Դրանք հնարավոր չէ անջատել։
        </li>
        <li>
          <strong>Նախապատվությունների թխուկներ՝</strong> հիշում են ձեր լեզվի
          կարգավորումը։
        </li>
        <li>
          <strong>Վերլուծական թխուկներ՝</strong> անանուն օգտագործման տվյալներ
          հարթակի բարելավման համար։ Կարող եք հրաժարվել բրաուզերի
          կարգավորումների միջոցով։
        </li>
      </ul>

      <h2>9. Երեխաների Գաղտնիություն</h2>
      <p>
        Dasavandir.org-ը նախատեսված է <strong>16 և բարձր</strong> տարեկան
        օգտատերերի համար։ Մենք գիտակցաբար չենք հավաքում 16 տարեկանից փոքր
        երեխաների անձնական տվյալներ։ Եթե կարծում եք, որ 16 տարեկանից փոքր
        երեխա հաշիվ է ստեղծել, անմիջապես կապ հաստատեք մեզ հետ, և մենք
        կջնջենք հաշիվը։
      </p>

      <h2>10. Փոփոխություններ</h2>
      <p>
        Մենք կարող ենք ժամանակ առ ժամանակ թարմացնել սույն Գաղտնիության
        Քաղաքականությունը։ Էական փոփոխությունների դեպքում մենք ծանուցելու ենք
        ձեզ էլ. փոստով կամ հարթակում աչքի ընկնող ծանուցմամբ՝ փոփոխությունն
        ուժի մեջ մտնելուց առնվազն 14 օր առաջ։
      </p>

      <h2>11. Կապ</h2>
      <p>Գաղտնիության հետ կապված ցանկացած հարցի կամ հայցի համար.</p>
      <ul>
        <li><strong>Teach For Armenia — Տվյալների Պաշտպանություն</strong></li>
        <li>Էլ. հասցե՝ <a href="mailto:privacy@dasavandir.org">privacy@dasavandir.org</a></li>
        <li>Հասցե՝ Երևան, Հայաստանի Հանրապետություն</li>
      </ul>
    </article>
  );
}
