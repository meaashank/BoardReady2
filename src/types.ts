export type StreamKey = 'PCM' | 'PCB' | 'PCMB';
export type SubjectName = 'Physics' | 'Chemistry' | 'Maths' | 'Biology' | 'English';
export type TabId = 'today' | 'plan' | 'study' | 'chapters' | 'settings';
export type ThemePref = 'system' | 'light' | 'dark';

export interface ChapterPin {
  date: string;
  time: string;
}

export interface Chapter {
  id: string;
  subject: SubjectName;
  name: string;
  num: number;
  secs: number;
  done: boolean;
  doneMin: number;
  test: string;
  pin: ChapterPin | null;
}

export interface SchedItem {
  k?: number;
  c: string;
  m: number;
  p: number;
  n: number;
  t?: string;
}

export interface StudyEntry {
  id: number;
  d: string;
  sub: SubjectName;
  min: number;
  src: 'timer' | 'manual';
}

export interface BoardState {
  v: number;
  setupDone: boolean;
  step: number;
  stream: StreamKey;
  chapters: Chapter[];
  nextId: number;
  nextK: number;
  playlists: Partial<Record<SubjectName, string>>;
  speed: number;
  noteMin: number;
  practicePct: number;
  hoursPerDay: number;
  examDate: string;
  planDays: number;
  planStart: string;
  sched: Record<string, SchedItem[]>;
  schedFor: string;
  todaySubj: string;
  log: Record<string, SchedItem[]>;
  study: StudyEntry[];
  studyNext: number;
  pomo: {
    sub: string;
    done: number;
  };
  best: number;
  planKind: '30' | '60' | '90' | 'custom';
  customMode: 'days' | 'date';
  customDays: number | string;
  customEnd: string;
  theme?: ThemePref;
}

export interface LadderOption {
  s: number;
  k: number;
}

export interface PlanDayResult {
  items: SchedItem[];
  used: number;
  subs: Record<string, number>;
}

export interface PlaceResult {
  days: PlanDayResult[];
  lim: (i: number) => number;
  opt: LadderOption;
  remaining: number;
  lastIdx: number;
  fits: boolean;
}

export interface ComputePlanResult {
  plan: PlaceResult;
  optIdx: number;
  total: number;
  kept: SchedItem[];
  D: number;
  logged: number;
  pinsCount: number;
}

export interface PlanStatus {
  kind: 'done' | 'ok' | 'ramp' | 'no';
  peak: number;
  over: number;
}

export interface ActivePlanInfo {
  cp: ComputePlanResult;
  st: PlanStatus;
  w: {
    end: string;
    D: number;
  };
}

export interface BulkVideoItem {
  d: string;
  secs: number;
  title: string;
  ctx: string;
  ch: string;
  how: '' | 'name' | 'number' | 'you';
}

export const STORAGE_KEY = 'boardready.v1';

export const ROT: SubjectName[] = ['Maths', 'Biology', 'English', 'Chemistry', 'Physics'];

export const STREAMS: Record<StreamKey, SubjectName[]> = {
  PCM: ['Physics', 'Chemistry', 'Maths', 'English'],
  PCB: ['Physics', 'Chemistry', 'Biology', 'English'],
  PCMB: ['Physics', 'Chemistry', 'Maths', 'Biology', 'English'],
};

export const STREAM_NOTE: Record<StreamKey, string> = {
  PCM: 'Physics, Chemistry, Maths, English',
  PCB: 'Physics, Chemistry, Biology, English',
  PCMB: 'Physics, Chemistry, Maths, Biology, English',
};

export const DEFCH: Record<SubjectName, string[]> = {
  Physics: [
    'Electric Charges and Fields',
    'Electrostatic Potential and Capacitance',
    'Current Electricity',
    'Moving Charges and Magnetism',
    'Magnetism and Matter',
    'Electromagnetic Induction',
    'Alternating Current',
    'Electromagnetic Waves',
    'Ray Optics and Optical Instruments',
    'Wave Optics',
    'Dual Nature of Radiation and Matter',
    'Atoms',
    'Nuclei',
    'Semiconductor Electronics: Materials, Devices and Simple Circuits',
  ],
  Chemistry: [
    'Solutions',
    'Electrochemistry',
    'Chemical Kinetics',
    'The d- and f-Block Elements',
    'Coordination Compounds',
    'Haloalkanes and Haloarenes',
    'Alcohols, Phenols and Ethers',
    'Aldehydes, Ketones and Carboxylic Acids',
    'Amines',
    'Biomolecules',
  ],
  Maths: [
    'Relations and Functions',
    'Inverse Trigonometric Functions',
    'Matrices',
    'Determinants',
    'Continuity and Differentiability',
    'Application of Derivatives',
    'Integrals',
    'Application of Integrals',
    'Differential Equations',
    'Vector Algebra',
    'Three Dimensional Geometry',
    'Linear Programming',
    'Probability',
  ],
  Biology: [
    'Sexual Reproduction in Flowering Plants',
    'Human Reproduction',
    'Reproductive Health',
    'Principles of Inheritance and Variation',
    'Molecular Basis of Inheritance',
    'Evolution',
    'Human Health and Disease',
    'Microbes in Human Welfare',
    'Biotechnology: Principles and Processes',
    'Biotechnology and its Applications',
    'Organisms and Populations',
    'Ecosystem',
    'Biodiversity and Conservation',
  ],
  English: [
    'Flamingo: The Last Lesson',
    'Flamingo: Lost Spring',
    'Flamingo: Deep Water',
    'Flamingo: The Rattrap',
    'Flamingo: Indigo',
    'Flamingo: Poets and Pancakes',
    'Flamingo: The Interview',
    'Flamingo: Going Places',
    'Flamingo Poetry: My Mother at Sixty-six',
    'Flamingo Poetry: Keeping Quiet',
    'Flamingo Poetry: A Thing of Beauty',
    'Flamingo Poetry: A Roadside Stand',
    "Flamingo Poetry: Aunt Jennifer's Tigers",
    'Vistas: The Third Level',
    'Vistas: The Tiger King',
    'Vistas: Journey to the End of the Earth',
    'Vistas: The Enemy',
    'Vistas: On the Face of It',
    'Vistas: Memories of Childhood',
    'Writing Skills: Notice, Letter, Report, Article',
    'Reading Comprehension Practice',
  ],
};

export const LINES: string[] = [
  'One chapter at a time. That is how a syllabus gets finished.',
  'Showing up counts. Tick one box and the day is a win.',
  'Small steps today, steady marks in February.',
  'You do not need a perfect day, only a started one.',
  'Slow and steady beats a last-week sprint.',
  'Notes you make today make revision easy later.',
  'Start with the chapter you like most and the rest follows.',
  'Consistency is the real shortcut.',
  'Every ticked chapter is one less to worry about.',
  'Keep the streak alive. Even a short session counts.',
  'Take short breaks. A rested mind remembers more.',
  'You have a plan. Today, just follow it.',
  'Progress looks slow each day and huge each week.',
  'Focus on the next hour and nothing else.',
  'Be kind to yourself and keep going.',
  'Hard chapters get easier on the second look.',
  'Phone away, timer on, first chapter open.',
  'You are closer than you were yesterday.',
  'Understanding beats rereading. Pause and test yourself.',
  "Finish what is on today's list and call it a good day.",
];

export const LADDER: LadderOption[] = [
  { s: 0, k: 1 },
  { s: 0.25, k: 4 },
  { s: 0.25, k: 3 },
  { s: 0.25, k: 2 },
  { s: 0.5, k: 3 },
  { s: 0.5, k: 2 },
  { s: 0.75, k: 2 },
  { s: 1, k: 2 },
  { s: 1, k: 1 },
];

export const NOTE_TITLE = 'A note from Bhavya';
export const NOTE_LINES: string[] = [
  'Hi! I am Bhavya, and I made Board Ready for students like you.',
  'The boards can feel huge when you look at the whole syllabus at once. That is why this app breaks it into small chapters and one day at a time. You only have to do today.',
  'Some days will go perfectly and some days will not. That is completely normal. If you miss a day, the plan adjusts and you carry on. Do not carry guilt, just pick up the next chapter.',
  'Take breaks, sleep well and eat properly. Your marks matter, and so do you.',
  'I am rooting for you. Tick one box at a time and you will get there. All the very best for your boards!',
];
export const NOTE_SIGN = 'With love, Bhavya (Halchuuu)';

export const CAPH = 8;
