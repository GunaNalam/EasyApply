// Persistent state in chrome.storage.local — survives browser restarts and is shared by
// every tab, the side panel and the background worker.

import type { Profile, SavedAnswer, StoredResume } from './types';
import { DEFAULT_PROFILE } from './profile';
import { similarity } from './text';

export interface Application {
  id: string;
  company: string;
  title: string;
  url: string;
  appliedAt: number;
  status: 'applied' | 'interview' | 'rejected' | 'offer';
}

export interface AppState {
  profile: Profile;
  answers: SavedAnswer[];
  resume: StoredResume | null;
  applications: Application[];
}

const EMPTY: AppState = { profile: DEFAULT_PROFILE, answers: [], resume: null, applications: [] };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function loadState(): Promise<AppState> {
  const raw = (await chrome.storage.local.get(['profile', 'answers', 'resume', 'applications'])) as Partial<AppState>;
  return {
    profile: { ...DEFAULT_PROFILE, ...(raw.profile ?? {}) },
    answers: raw.answers ?? [],
    resume: raw.resume ?? null,
    applications: raw.applications ?? [],
  };
}

export async function saveProfile(profile: Profile): Promise<void> {
  await chrome.storage.local.set({ profile });
}

export async function saveAnswers(answers: SavedAnswer[]): Promise<void> {
  await chrome.storage.local.set({ answers });
}

export async function saveResume(resume: StoredResume | null): Promise<void> {
  await chrome.storage.local.set({ resume });
}

export async function saveApplications(applications: Application[]): Promise<void> {
  await chrome.storage.local.set({ applications });
}

/** Questions this similar are treated as the same question when saving. */
export const SAME_QUESTION = 0.92;

/** Insert or update a saved answer (question/answer already templatized). */
export function upsertAnswer(list: SavedAnswer[], question: string, answer: string): SavedAnswer[] {
  const now = Date.now();
  const i = list.findIndex((a) => similarity(a.question, question) >= SAME_QUESTION);
  if (i >= 0) {
    const copy = list.slice();
    copy[i] = { ...copy[i], answer, updatedAt: now };
    return copy;
  }
  return [...list, { id: uid(), question, answer, uses: 0, updatedAt: now }];
}

export async function addApplication(app: Omit<Application, 'id' | 'appliedAt' | 'status'>): Promise<boolean> {
  const { applications } = await loadState();
  // Same URL within a day counts once.
  const dup = applications.some((a) => a.url === app.url && Date.now() - a.appliedAt < 86_400_000);
  if (dup) return false;
  await saveApplications([{ ...app, id: uid(), appliedAt: Date.now(), status: 'applied' }, ...applications]);
  return true;
}

export function exportJson(state: AppState): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export async function importJson(text: string): Promise<void> {
  const data = JSON.parse(text) as Partial<AppState>;
  const cur = await loadState();
  await chrome.storage.local.set({
    profile: { ...cur.profile, ...(data.profile ?? {}) },
    answers: Array.isArray(data.answers) ? data.answers : cur.answers,
    resume: data.resume ?? cur.resume,
    applications: Array.isArray(data.applications) ? data.applications : cur.applications,
  });
}

export { EMPTY as EMPTY_STATE };
