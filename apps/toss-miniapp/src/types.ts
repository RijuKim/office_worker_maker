export type Screen = "home" | "create" | "play" | "records";

export type Stats = Record<string, number>;

export interface CharacterData {
  id: string;
  name: string;
  age: number;
  startGradeYear: number;
  currentGradeYear: number | null;
  major: string;
  academicStatus: string;
  stats: Stats;
  relationships: { name: string; role: string; trust: number; tags: string[] }[];
  eventHistory: { summary: string; createdAt: string }[];
  currentEventId: string | null;
  coreEventCount: number;
  progressLabel?: string;
  lifeStage?: {
    term?: { label?: string };
    lifeStage?: string;
    graduation?: string;
  };
  events?: EventData[];
}

export interface EventData {
  id: string;
  title: string;
  body: string;
  choices: { id: string; label: string; statDelta: Stats }[];
  source: string;
  forced?: boolean;
}

export interface ChoiceFeedback {
  statDelta: Stats;
  relationshipDelta: { name: string; trust: number }[];
  summary: string;
}

export interface CareerRecord {
  id: string;
  title?: string;
  destination?: string;
  summary?: string;
  satisfaction?: number;
  createdAt?: string;
  tags?: string[];
  [key: string]: unknown;
}
