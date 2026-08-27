// Auto-converted from backend/utils/observationRubrics.js

const round2 = (n: number) => Math.round(n * 100) / 100;

export const TEACHING_RUBRIC_CATEGORIES = [
  {
    "key": "academicPreparedness",
    "name": "Ակադեմիական պատրաստվածություն",
    "criteria": [
      "Դասի համար սահմանված վերջնարդյունքները թիրախային և իրատեսական են տվյալ դասի իրականացման համար",
      "Նոր նյութի բովանդակությունը և հիմնական դրույթները ներկայացվում են համակարգված տրամաբանությամբ և հստակ",
      "Դասի տարբեր փուլերում նախատեսված նյութը մատուցում է մատչելի լեզվով, համապատասխան օրինակներով և դիդակտիկ նյութերով",
      "Սահմանված առաջադրանքները/հանձնարարությունները բխում են թեմայից և վերջնարդյունքներից (կամ հարցադրումները և առաջադրանքները խթանում են քննական մտածողության հմտությունների զարգացումը)",
      "Դասի թեման կապվում է անցած նյութերի, հարակից առարկաների կամ կյանքի իրական օրինակների հետ՝ խթանելով թեմայի ամբողջական ըմբռնումը"
    ]
  },
  {
    "key": "teachingSkills",
    "name": "Դասավանդման հմտություններ",
    "criteria": [
      "Դասն ամբողջությամբ իրականացվում է ՈւՀԴ/ ՈւՀՁ կառուցվածքով՝ դասի փուլերի միջև փոխակապվածության ապահովմամբ",
      "Նյութի ներկայացման բազմաբնույթ եղանակներ և մեթոդներ են կիրառվում",
      "Ընկալման ստուգման տարատեսակ տեխնիկաներ են կիրառվում բոլոր աշակերտներին ներգրավելու համար",
      "Իրականացնում է ուղղորդված աշխատանք՝ հստակ հետադարձ կապերով, ամփոփումներով և արդյունքների գնահատմամբ",
      "Ցուցաբերվում է արդյունավետ ժամանակի կառավարում"
    ]
  },
  {
    "key": "classroomCulture",
    "name": "Դասարանային կարգապահություն և մշակույթ",
    "criteria": [
      "Սահմանվել են դասարանային ակնկալիքներ, նորմեր ու ընթացակարգերը, ապահովվում է վերջիններիս տեսանելիությունը, կիրառությունը և հետևողականությունը",
      "Սովորող-ուսուցիչ, սովորող-սովորող փոխհարաբերությունները դրական են, հարգալից ու ջերմ",
      "Ուսուցիչը դասի բոլոր փուլերում հնարավորություն է տալիս սովորողներին ներգրավվելու ուսումնական գործընթացի մեջ՝ հարցերի, առաջադրանքների, թիմային և ինքնուրույն աշխատանքի միջոցով",
      "Հրահանգները տրվում են ամբողջական, հստակ ու հասկանալի և հնարավորություն են տալիս բոլոր սովորողներին ներգրավվել գործընթացներին",
      "Դասի ընթացքում ապահովվում են սովորողների ՍՀ հմտությունների և առաջնորդական կարողունակությունների զարգացման նախապայմանները (ՍՀՈւ բաղադրիչների և Առաջնորդական կարողունակությունների կապը)"
    ]
  }
] as const;

export const PLANNING_RUBRIC_CRITERIA = [
  {
    "key": "lessonOutcomes",
    "label": "Դասի վերջնարդյունքներ — դասի համար սահմանված ակադեմիական վերջնարդյունքները թիրախային են և իրատեսական, առաջնորդական վերջնարդյունքների համար նշված են հստակ քայլեր (դիտարկվում է ըստ նպատակահարմարության)"
  },
  {
    "key": "structure",
    "label": "Դասի կառուցվածք և փուլերի փոխկապվածություն — դասի բոլոր 5 փուլերը ներկայացված են և բխում են դասի առարկայական (և առաջնորդական) վերջնարդյունքներից ու նոր նյութից, փուլերի ժամաբաշխումն իրատեսական է և տրամաբանական"
  },
  {
    "key": "newMaterial",
    "label": "Նոր նյութի բովանդակություն և կարևոր դրույթներ — հստակորեն ներկայացված են դասի կարևոր դրույթները, հասկացությունները, սահմանումներն ու օրինակները, պարզ են բացատրման մեթոդները, բոլոր հավելյալ նյութերը կցված են ակտիվ հղմամբ, առկա են ընթացիկ ընկալման ստուգումներ"
  },
  {
    "key": "tasksAndQuestions",
    "label": "Հարցեր/հանձնարարություններ/առաջադրանքներ և ընկալման ստուգում — եռամակարդակ են և համապատասխանում են Բլում-Անդերսոնի աստիճանակարգին, առկա են դասի տարբեր փուլերում, խթանում են քննական մտածողության հմտությունների զարգացումը"
  },
  {
    "key": "instructions",
    "label": "Հրահանգներ — դասի համապատասխան փուլերում առկա են բովանդակային և տեխնիկական հրահանգներ, ձևակերպված հստակ տրամաբանությամբ (ի՞նչ անել, ինչպե՞ս անել, որքա՞ն ժամանակ է հատկացված, ի՞նչ անել ավարտելուց հետո), առկա են հրահանգների ընկալման ստուգումներ"
  }
] as const;

export const OVERALL_EXPECTATIONS_CRITERIA = [
  {
    "key": "planningSkill",
    "label": "Իրականացվում է դասի մանրամասն և ՈւՀԴ/ՈւՀՁ պահանջներին համապատասխան պլանավորում՝ նկատի ունենալով սովորողների կարիքները/առկա տվյալները (Պլանավորման հմտություն)"
  },
  {
    "key": "effectiveExecutionSkill",
    "label": "Ապահովվում է դասի արդյունավետ կազմակերպում և իրականացում (Արդյունավետ գործելու հմտություն)"
  },
  {
    "key": "analyticalSkill",
    "label": "Դրսևորվում են ինքնանդրադարձի և ինքնավերլուծության զարգացած հմտություններ (Վերլուծական հմտություններ)"
  },
  {
    "key": "feedbackResponsivenessSkill",
    "label": "Հետադարձ կապի հանդեպ դրսևորվում է բացության և հետևողականություն բարելավման ուղղությունների հարցում (Հետադարձ պլանավորման հմտություն)"
  },
  {
    "key": "synthesisAndAdvancementSkill",
    "label": "Դրսևորվում են թիրախային նպատակների և քայլերի վերհանման, մասնագիտական և առաջնորդական կարողունակությունների զարգացման հմտություններ (Սովորածը ամփոփելու հմտություն և առաջխաղացում)"
  }
] as const;

export const TIMELINE_PHASES = [
  "Դասի վերջնարդյունքներ",
  "Դասի սկիզբ / Նոր նյութ",
  "Գործնական աշխատանք",
  "Ինքնուրույն աշխատանք",
  "Դասի ավարտ"
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any */

interface RubricRow {
  key: string;
  label: string;
  score: number | null;
  comment: string;
}

export function computeTeachingRubric(input: any) {
  const safe = input ?? {};
  const submittedCategories: any[] = Array.isArray(safe.categories) ? safe.categories : [];

  const categories = TEACHING_RUBRIC_CATEGORIES.map((catDef) => {
    const submitted = submittedCategories.find((c: any) => c?.key === catDef.key) ?? {};
    const submittedRows: any[] = Array.isArray(submitted.rows) ? submitted.rows : [];

    const rows: RubricRow[] = catDef.criteria.map((label, i) => {
      const r = submittedRows[i] ?? {};
      return {
        key: `${catDef.key}-${i}`,
        label,
        score: typeof r.score === "number" ? Math.max(0, Math.min(5, Math.round(r.score))) : null,
        comment: (r.comment ?? "").slice(0, 3000),
      };
    });

    const scored = rows.filter((r) => r.score !== null);
    const categoryAverage =
      scored.length > 0
        ? round2(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length)
        : null;

    return {
      key: catDef.key,
      name: catDef.name,
      rows,
      categoryComment: (submitted.categoryComment ?? "").slice(0, 5000),
      categoryAverage,
    };
  });

  const validAverages = categories.map((c) => c.categoryAverage).filter((n): n is number => typeof n === "number");
  const overallAverage =
    validAverages.length > 0
      ? round2(validAverages.reduce((a, b) => a + b, 0) / validAverages.length)
      : null;

  return {
    headline: {
      score: typeof safe.headline?.score === "number" ? safe.headline.score : null,
      comment: (safe.headline?.comment ?? "").slice(0, 3000),
    },
    categories,
    overallAverage,
    summaryComment: (safe.summaryComment ?? "").slice(0, 5000),
  };
}

export function computeFlatRubric(criteria: readonly { key: string; label: string }[], input: any) {
  const safe = input ?? {};
  const submittedRows: any[] = Array.isArray(safe.rows) ? safe.rows : [];

  const rows: RubricRow[] = criteria.map((def, i) => {
    const r = submittedRows.find((x: any) => x?.key === def.key) ?? submittedRows[i] ?? {};
    return {
      key: def.key,
      label: def.label,
      score: typeof r.score === "number" ? Math.max(0, Math.min(5, Math.round(r.score))) : null,
      comment: (r.comment ?? "").slice(0, 3000),
    };
  });

  const scored = rows.filter((r) => r.score !== null);
  const overallAverage =
    scored.length > 0
      ? round2(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length)
      : null;

  return {
    rows,
    overallAverage,
    generalComment: (safe.generalComment ?? "").slice(0, 5000),
  };
}

export const computePlanningRubric = (input: any) => computeFlatRubric(PLANNING_RUBRIC_CRITERIA, input);
export const computeOverallExpectationsRubric = (input: any) => computeFlatRubric(OVERALL_EXPECTATIONS_CRITERIA, input);

export function computeGrandAverage(...averages: (number | null | undefined)[]) {
  const valid = averages.filter((n): n is number => typeof n === "number");
  return valid.length > 0 ? round2(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}

export function normalizeTimeline(input: any) {
  const submitted: any[] = Array.isArray(input) ? input : [];
  return TIMELINE_PHASES.map((phase, i) => {
    const r = submitted.find((x: any) => x?.phase === phase) ?? submitted[i] ?? {};
    return {
      phase,
      teacherActions: r.teacherActions ?? "",
      studentActions: r.studentActions ?? "",
      questionsObservations: r.questionsObservations ?? "",
    };
  });
}

export function normalizeGoals(input: any) {
  const submitted: any[] = Array.isArray(input) ? input : [];
  return [0, 1, 2].map((i) => ({
    goal: submitted[i]?.goal ?? "",
    steps: submitted[i]?.steps ?? "",
  }));
}
