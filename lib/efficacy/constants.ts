export const SCORE_SCALE = [
  { value: 0, label: "Լիովին բացակայում է" },
  { value: 1, label: "Ապահովված չէ" },
  { value: 2, label: "Խիստ թերի է ապահովված" },
  { value: 3, label: "Մասամբ է ապահովված" },
  { value: 4, label: "Գրեթե ապահովված է" },
  { value: 5, label: "Լիովին ապահովված է" },
] as const;

export interface CompetencyCategory {
  key: string;
  name: string;
  competencies: string[];
}

export const COMPETENCY_CATEGORIES: CompetencyCategory[] = [
  {
    key: "self-leadership",
    name: "Անձնային Առաջնորդություն և Ինքնակարգավորում",
    competencies: [
      "Ինքնաճանաչում",
      "Ինքնակարգավորում",
      "Տոկունություն և ճկունություն",
      "Հետաքրքրվածություն",
      "Ինքնուրույն ուսումնառություն",
      "Հետադարձ կապի և բարելավման մշակույթ",
    ],
  },
  {
    key: "strategic-thinking",
    name: "Ռազմավարական Մտածողություն և Լուծումներ",
    competencies: [
      "Մեծ տեսլական և իրադրության գնահատում",
      "Երկարաժամկետ որոշումների կայացում",
      "Լուծումնամետ գործունեություն",
    ],
  },
  {
    key: "communication",
    name: "Հաղորդակցություն և Սոցիալական Ազդեցություն",
    competencies: [
      "Հաղորդակցություն",
      "Հարաբերությունների կառուցում ու ցանցի ընդլայնում",
      "Բարդ խոսակցությունների վարում",
    ],
  },
  {
    key: "management",
    name: "Կառավարում և Արդյունքամետություն",
    competencies: [
      "Պլանավորում և ռեսուրսների կառավարում",
      "Ինքնավարություն",
      "Արդյունքամետ գործունեություն",
    ],
  },
  {
    key: "data-judgment",
    name: "Տվյալների Վերլուծություն և Կշռադատում",
    competencies: [
      "Հետևողական մշտադիտարկում",
      "Դադար և կշռադատում",
      "Սովորածի համադրում և կիրառում",
    ],
  },
];

export const ALL_COMPETENCIES = COMPETENCY_CATEGORIES.flatMap((c) => c.competencies);
