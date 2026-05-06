"use client";
import { useState } from "react";
import Link from "next/link";

const LAST_UPDATED = "May 6, 2026";
const LAST_UPDATED_HY = "Մայիս 6, 2026";

export default function TermsPage() {
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
        {lang === "en" ? <TermsEN /> : <TermsHY />}
      </div>
    </div>
  );
}

function TermsEN() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: {LAST_UPDATED}</p>

      <p>
        Welcome to <strong>Dasavandir.org</strong>, an AI-powered learning management system
        operated by <strong>Teach For Armenia</strong> (Unified Register No. 282.110.930088), a
        nonprofit organization registered in the Republic of Armenia (&ldquo;Teach For Armenia&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;).
      </p>
      <p>
        By creating an account or using this platform, you (&ldquo;User&rdquo;, &ldquo;you&rdquo;) agree to be
        bound by these Terms of Service (&ldquo;Terms&rdquo;) and our{" "}
        <Link href="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link>.
        Please read them carefully. If you do not agree, do not use the platform.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least <strong>16 years old</strong> to create an account on Dasavandir.org.
        If you are between 16 and 18, you confirm that you have obtained the necessary parental or
        guardian consent required in your jurisdiction. By using the platform, you represent and
        warrant that you meet these requirements.
      </p>

      <h2>2. Account Registration</h2>
      <ul>
        <li>You must provide accurate, complete, and current information during registration.</li>
        <li>You are responsible for maintaining the confidentiality of your password.</li>
        <li>You are responsible for all activity that occurs under your account.</li>
        <li>
          You must notify us immediately at{" "}
          <a href="mailto:support@dasavandir.org">support@dasavandir.org</a> if you suspect
          unauthorised access to your account.
        </li>
        <li>
          Each person may only maintain one account. Creating multiple accounts to circumvent
          restrictions is prohibited.
        </li>
      </ul>

      <h2>3. Acceptable Use</h2>
      <p>When using Dasavandir.org, you agree <strong>not</strong> to:</p>
      <ul>
        <li>
          Share, reproduce, or distribute any course content outside the platform without explicit
          written permission from the content creator and Teach For Armenia.
        </li>
        <li>
          Submit work that is not your own in assignments without proper attribution (plagiarism).
        </li>
        <li>
          Use the AI Coach or any platform feature to generate, distribute, or engage with content
          that is harmful, unlawful, abusive, harassing, defamatory, or discriminatory.
        </li>
        <li>
          Attempt to reverse-engineer, scrape, or extract data from the platform without
          authorisation.
        </li>
        <li>
          Impersonate any person or entity, or misrepresent your affiliation with any organisation.
        </li>
        <li>
          Interfere with the platform&apos;s security, stability, or the experience of other users.
        </li>
        <li>Use the platform for commercial purposes unrelated to your own learning.</li>
      </ul>

      <h2>4. Course Content and Intellectual Property</h2>
      <p>
        <strong>Our content:</strong> All course materials, lesson content, platform design, and
        branding are the intellectual property of Teach For Armenia or the respective course
        creators, protected by copyright and applicable law. You may access content solely for your
        personal, non-commercial educational use.
      </p>
      <p>
        <strong>Your content:</strong> You retain ownership of any original content you create on
        the platform (e.g. assignment submissions, discussion posts). By submitting content, you
        grant Teach For Armenia a non-exclusive, royalty-free licence to use that content for
        platform operation and improvement, including for AI model evaluation and feedback
        generation within the platform.
      </p>
      <p>
        <strong>AI-generated content:</strong> Content generated by the AI features of the platform
        is provided as an educational aid. We do not guarantee its accuracy or completeness. You are
        responsible for verifying AI-generated information before relying on it.
      </p>

      <h2>5. Certificates and Completion</h2>
      <p>
        Upon successfully completing a course, you may receive a digital certificate of completion.
        Certificates verify completion of the course requirements only and do not constitute a
        formal academic qualification unless explicitly stated. Teach For Armenia reserves the right
        to revoke certificates if a user is found to have violated these Terms (e.g. academic
        dishonesty).
      </p>

      <h2>6. Privacy and Data</h2>
      <p>
        Your use of the platform is subject to our{" "}
        <Link href="/privacy" className="text-brand-600 hover:underline">Privacy Policy</Link>,
        which is incorporated into these Terms by reference. By using the platform, you consent to
        the collection and use of your data as described in the Privacy Policy.
      </p>

      <h2>7. AI Features — Disclaimer</h2>
      <p>
        The AI Coach, AI Course Builder, and AI assignment evaluation features are provided as
        supplementary educational tools. They are <strong>not</strong> a substitute for qualified
        instruction or professional advice. AI responses may contain errors or inaccuracies. Teach
        For Armenia makes no warranty regarding the accuracy, reliability, or fitness for purpose
        of AI-generated content.
      </p>

      <h2>8. Platform Availability</h2>
      <p>
        We strive to keep Dasavandir.org available at all times but cannot guarantee uninterrupted
        access. We may temporarily suspend the platform for maintenance, security updates, or other
        operational reasons. We are not liable for any losses resulting from platform downtime.
      </p>

      <h2>9. Termination</h2>
      <p>
        <strong>By you:</strong> You may delete your account at any time by contacting us at{" "}
        <a href="mailto:support@dasavandir.org">support@dasavandir.org</a>. Upon deletion, your
        personal data will be handled in accordance with our Privacy Policy.
      </p>
      <p>
        <strong>By us:</strong> We reserve the right to suspend or permanently terminate your
        account without prior notice if we reasonably believe you have materially violated these
        Terms, including but not limited to: fraud, abuse of the AI systems, or academic
        dishonesty. Where possible, we will provide a warning before termination.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by applicable law, Teach For Armenia and its officers,
        directors, employees, and affiliates shall not be liable for any indirect, incidental,
        special, consequential, or punitive damages arising out of your use of, or inability to
        use, the platform.
      </p>
      <p>
        Our total aggregate liability for any claim arising out of or relating to these Terms or
        the platform shall not exceed the amount you have paid us in the twelve months preceding
        the claim, or AMD 50,000 (Armenian Drams), whichever is greater.
      </p>
      <p>
        Nothing in these Terms limits or excludes liability for death or personal injury caused by
        our negligence, fraud, or any other liability that cannot be excluded by law.
      </p>

      <h2>11. Disclaimer of Warranties</h2>
      <p>
        The platform is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without any warranty, express or
        implied, including warranties of merchantability, fitness for a particular purpose, or
        non-infringement. We do not warrant that the platform will be error-free or that defects
        will be corrected.
      </p>

      <h2>12. Governing Law and Dispute Resolution</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the{" "}
        <strong>Republic of Armenia</strong>. Any dispute arising out of or in connection with
        these Terms shall first be attempted to be resolved through good-faith negotiation. If
        unresolved within 30 days, disputes shall be submitted to the competent courts of the
        Republic of Armenia.
      </p>
      <p>
        If you are a consumer located in the European Union, you may also have the right to use
        the EU Online Dispute Resolution platform.
      </p>

      <h2>13. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. When we make material changes, we will notify
        you by email or by a prominent notice on the platform at least <strong>14 days</strong>{" "}
        before the changes take effect. Continued use of the platform after the effective date
        constitutes acceptance of the updated Terms.
      </p>

      <h2>14. Contact</h2>
      <p>For any questions about these Terms:</p>
      <ul>
        <li><strong>Teach For Armenia — Legal</strong></li>
        <li>Email: <a href="mailto:support@dasavandir.org">support@dasavandir.org</a></li>
        <li>Address: Yerevan, Republic of Armenia</li>
      </ul>
    </article>
  );
}

function TermsHY() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Օգտագործման Պայմաններ</h1>
      <p className="text-sm text-gray-500 mb-8">Վերջին թարմացում՝ {LAST_UPDATED_HY}</p>

      <p>
        Բարի գալուստ <strong>Dasavandir.org</strong>՝ AI-ով աշխատող ուսուցման կառավարման
        համակարգ, որը շահագործում է <strong>Teach For Armenia</strong>-ն (Միասնական
        ռեգիստր՝ 282.110.930088)՝ Հայաստանի Հանրապետությունում գրանցված ոչ առևտրային
        կազմակերպություն («Teach For Armenia», «մենք», «մեզ» կամ «մեր»)։
      </p>
      <p>
        Հաշիվ ստեղծելով կամ հարթակն օգտագործելով՝ Դուք («Օգտատեր», «Դուք») համաձայնում
        եք կատարել սույն Օգտագործման Պայմանները («Պայմաններ») և մեր{" "}
        <Link href="/privacy" className="text-brand-600 hover:underline">Գաղտնիության Քաղաքականությունը</Link>։
        Խնդրում ենք ուշադիր կարդալ։ Եթե համաձայն չեք, խնդրում ենք չօգտագործել հարթակը։
      </p>

      <h2>1. Իրավունակություն</h2>
      <p>
        Dasavandir.org-ում հաշիվ ստեղծելու համար Դուք պետք է լինեք առնվազն{" "}
        <strong>16 տարեկան</strong>։ Եթե Դուք 16-ից 18 տարեկան եք, Դուք հաստատում եք, որ
        ձեռք եք բերել ձեր երկրի օրենսդրությամբ պահանջվող ծնողական կամ խնամակալի
        համաձայնությունը։ Հարթակն օգտագործելով՝ Դուք հայտարարում եք, որ բավարարում եք
        այս պայմանները։
      </p>

      <h2>2. Հաշվի Գրանցում</h2>
      <ul>
        <li>Գրանցման ժամանակ Դուք պետք է տրամադրեք ճշգրիտ, ամբողջական և ժամանակակից տեղեկատվություն։</li>
        <li>Դուք պատասխանատու եք ձեր գաղտնաբառի գաղտնիության պահպանման համար։</li>
        <li>Դուք պատասխանատու եք ձեր հաշվի ներքո կատարված բոլոր գործողությունների համար։</li>
        <li>
          Ձեր հաշվի կասկածելի չլիազորված մուտքի դեպքում անմիջապես ծանուցեք մեզ՝{" "}
          <a href="mailto:support@dasavandir.org">support@dasavandir.org</a> հասցեով։
        </li>
        <li>
          Յուրաքանչյուր անձ կարող է ունենալ միայն մեկ հաշիվ։ Սահմանափակումներից
          խուսափելու նպատակով մի քանի հաշիվ ստեղծելն արգելված է։
        </li>
      </ul>

      <h2>3. Ընդունելի Օգտագործում</h2>
      <p>Dasavandir.org-ն օգտագործելիս Դուք համաձայնում եք <strong>չ</strong>անել հետևյալը.</p>
      <ul>
        <li>
          Կիսվել, վերարտադրել կամ տարածել դասընթացի ցանկացած բովանդակություն հարթակից
          դուրս՝ առանց բովանդակություն ստեղծողի և Teach For Armenia-ի բացահայտ
          գրավոր թույլտվության։
        </li>
        <li>
          Առաջադրանքներում ներկայացնել ուրիշի աշխատանքն առանց պատշաճ վկայակոչման
          (գրագողություն)։
        </li>
        <li>
          AI Դաստիարակն կամ հարթակի ցանկացած գործառույթ օգտագործել վնասակար,
          ապօրինի, վիրավորական, ոտնձգային, զրպարտիչ կամ խտրական բովանդակություն
          ստեղծելու, տարածելու կամ ընդգրկելու համար։
        </li>
        <li>
          Փորձել հակադարձ ճարտարագիտության ենթարկել, scrape անել կամ տվյալներ
          արտահանել հարթակից՝ առանց լիազորության։
        </li>
        <li>
          Ձևանալ ուրիշ անձ կամ կազմակերպություն, կամ կեղծ ներկայացնել ձեր
          պատկանելությունը որևէ կազմակերպության։
        </li>
        <li>
          Խաթարել հարթակի անվտանգությունը, կայունությունը կամ այլ օգտատերերի
          փորձը։
        </li>
        <li>Հարթակն օգտագործել ձեր սեփական ուսուցմանը անկապ առևտրային նպատակներով։</li>
      </ul>

      <h2>4. Դասընթացի Բովանդակությունը և Մտավոր Սեփականությունը</h2>
      <p>
        <strong>Մեր բովանդակությունը՝</strong> Բոլոր դասընթացի նյութերը, դասի
        բովանդակությունը, հարթակի ձևավորումը և ապրանքանիշը Teach For Armenia-ի կամ
        համապատասխան դասընթաց ստեղծողների մտավոր սեփականությունն են, պաշտպանված
        հեղինակային իրավունքով և կիրառելի օրենসդրությամբ։ Բովանդակությանն
        կարող եք մուտք գործել բացառապես ձեր անձնական, ոչ առևտրային ուսումնական
        նպատակներով։
      </p>
      <p>
        <strong>Ձեր բովանդակությունը՝</strong> Դուք պահպանում եք հարթակում ստեղծած
        ձեր բնօրինակ բովանդակության (օր.՝ առաջադրանքների ներկայացումներ, քննարկման
        գրառումներ) սեփականությունը։ Բովանդակություն ներկայացնելով՝ Դուք Teach For
        Armenia-ին շնորհում եք ոչ բացառիկ, անվճար լիցենզիա՝ օգտագործելու այդ
        բովանդակությունը հարթակի շահագործման և բարելավման, ներառյալ AI
        մոդելի գնահատման ու հարթակի շրջանակում արձագանք ստեղծելու համար։
      </p>
      <p>
        <strong>AI-ի կողմից ստեղծված բովանդակությունը՝</strong> Հարթակի AI
        գործառույթներով ստեղծված բովանդակությունն ապահովվում է որպես կրթական
        օժանդակ միջոց։ Մենք չենք երաշխավորում դրա ճշգրտությունը կամ
        ամբողջականությունը։ Դուք պատասխանատու եք AI-ի կողմից ստեղծված
        տեղեկատվությունը ստուգելու համար՝ մինչ հիմնվելը դրա վրա։
      </p>

      <h2>5. Վկայագրեր և Ավարտ</h2>
      <p>
        Դասընթացն հաջողությամբ ավարտելուց հետո Դուք կարող եք ստանալ ավարտի
        թվային վկայագիր։ Վկայագրերը հաստատում են դասընթացի պահանջների
        կատարումը միայն և, բացահայտ նշված չլինելու դեպքում, պաշտոնական
        ակադեմիական որակավորում չեն ներկայացնում։ Teach For Armenia-ն իրավունք
        է պահպանում հետ կանչել վկայագրերը, եթե պարզվի, որ օգտատերը խախտել
        է սույն Պայմանները (օր.՝ ակադեմիական անազնվություն)։
      </p>

      <h2>6. Գաղտնիություն և Տվյալներ</h2>
      <p>
        Հարթակն օգտագործելը ենթակա է մեր{" "}
        <Link href="/privacy" className="text-brand-600 hover:underline">Գաղտնիության Քաղաքականությանը</Link>,
        որն ներառված է սույն Պայմաններում ուղղակի հղումով։ Հարթակն
        օգտագործելով՝ Դուք համաձայնում եք ձեր տվյալների հավաքման և
        Գաղտնիության Քաղաքականությամբ նկարագրված ձևով օգտագործման հետ։
      </p>

      <h2>7. AI Գործառույթներ — Հայտարարություն</h2>
      <p>
        AI Դաստիարակը, AI Դասընթաց Ստեղծողն ու AI առաջադրանք գնահատման
        գործառույթները ապահովվում են որպես լրացուցիչ կրթական գործիքներ։
        Դրանք <strong>չեն</strong> փոխարինում որակյալ ուսուցմանը կամ
        մասնագիտական խորհրդին։ AI-ի արձագանքները կարող են պարունակել
        սխալներ կամ անճշտություններ։ Teach For Armenia-ն երաշխիք չի
        տալիս AI-ի կողմից ստեղծված բովանդակության ճշգրտության,
        հուսալիության կամ նպատակայնության վերաբերյալ։
      </p>

      <h2>8. Հարթակի Հասանելիություն</h2>
      <p>
        Մենք ձգտում ենք Dasavandir.org-ն ամեն ժամ հասանելի պահել, բայց
        չենք կարող երաշխավորել անխափան մուտք։ Մենք կարող ենք ժամանակավորապես
        կասեցնել հարթակը տեխնիկական սպասարկման, անվտանգության
        թարմացումների կամ այլ գործառնական պատճառներով։ Մենք պատասխանատու
        չենք հարթակի անջատման հետ կապված կորուստների համար։
      </p>

      <h2>9. Դադարեցում</h2>
      <p>
        <strong>Ձեր կողմից՝</strong> Դուք կարող եք ցանկացած ժամանակ ջնջել
        ձեր հաշիվը՝ կապ հաստատելով մեզ հետ{" "}
        <a href="mailto:support@dasavandir.org">support@dasavandir.org</a>{" "}
        հասցեով։ Ջնջելու ժամանակ ձեր անձնական տվյալները կմշակվեն
        Գաղտնիության Քաղաքականությանը համաձայն։
      </p>
      <p>
        <strong>Մեր կողմից՝</strong> Մենք իրավունք ենք պահպանում առանց
        նախնական ծանուցման կասեցնել կամ մշտապես դադարեցնել ձեր հաշիվը,
        եթե ողջամտորեն կարծում ենք, որ Դուք էականորեն խախտել եք
        սույն Պայմանները, ներառյալ կեղծարարություն, AI համակարգերի
        չարաշահում կամ ակադեմիական անազնվություն։ Հնարավորության
        դեպքում դադարեցնելուց առաջ կտրամադրենք նախազգուշացում։
      </p>

      <h2>10. Պատասխանատվության Սահմանափակում</h2>
      <p>
        Կիրառելի օրենսդրությամբ թույլատրված առավելագույն չափով՝
        Teach For Armenia-ն և նրա ղեկավարները, տնօրենները,
        աշխատակիցները ու մասնաճյուղերը պատասխանատու չեն
        հարթակն օգտագործելու կամ անկարողության հետ կապված
        ոչ ուղղակի, պատահական, հատուկ, հետևանքային կամ
        պատժիչ վնասների համար։
      </p>
      <p>
        Ցանկացած պահանջի համար մեր ընդհանուր պատասխանատվությունը
        չի գերազանցի պահանջից նախորդող տասներկու ամիսների
        ընթացքում ձեր կողմից մեզ վճարված գումարը կամ
        50,000 ՀՀ դրամ (ամենից մեծ գումարը)։
      </p>

      <h2>11. Կիրառելի Օրենք և Վեճերի Լուծում</h2>
      <p>
        Սույն Պայմանները կարգավորվում և մեկնաբանվում են{" "}
        <strong>Հայաստանի Հանրապետության</strong> օրենսդրությամբ։
        Սույն Պայմաններից կամ դրանց հետ կապված ցանկացած
        վեճ նախ փորձ կանի լուծել բարի կամքի բանակցությունների
        միջոցով։ 30 օրվա ընթացքում չլուծելու դեպքում վեճերը
        կներկայացվեն Հայաստանի Հանրապետության
        իրավասու դատարաններ։
      </p>

      <h2>12. Փոփոխություններ</h2>
      <p>
        Մենք կարող ենք ժամանակ առ ժամանակ թարմացնել սույն
        Պայմանները։ Էական փոփոխությունների դեպքում մենք
        ծանուցելու ենք ձեզ էլ. փոստով կամ հարթակում
        աչքի ընկնող ծանուցմամբ՝ փոփոխությունն ուժի
        մեջ մտնելուց առնվազն <strong>14 օր</strong> առաջ։
        Ուժի մեջ մտնելու ամսաթվից հետո հարթակն
        օգտագործելը համարվում է թարմացված Պայմանների
        ընդունում։
      </p>

      <h2>13. Կապ</h2>
      <p>Սույն Պայմանների վերաբերյալ ցանկացած հարցի համար.</p>
      <ul>
        <li><strong>Teach For Armenia — Իրավաբանական Բաժին</strong></li>
        <li>Էլ. հասցե՝ <a href="mailto:support@dasavandir.org">support@dasavandir.org</a></li>
        <li>Հասցե՝ Երևան, Հայաստանի Հանրապետություն</li>
      </ul>
    </article>
  );
}
