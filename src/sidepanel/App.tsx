import { useCallback, useEffect, useState } from 'react';
import { FILL_MESSAGE, type FillResult } from '../shared/messages';
import { PROFILE_LABELS } from '../shared/profile';
import {
  exportJson,
  importJson,
  loadState,
  saveAnswers,
  saveApplications,
  saveProfile,
  saveResume,
  uid,
  type AppState,
  type Application,
} from '../shared/storage';
import type { Profile, SavedAnswer } from '../shared/types';

type Tab = 'fill' | 'profile' | 'answers' | 'applied' | 'backup';

export function App() {
  const [tab, setTab] = useState<Tab>('fill');
  const [state, setState] = useState<AppState | null>(null);

  const reload = useCallback(() => void loadState().then(setState), []);
  useEffect(() => {
    reload();
    const listener = () => reload();
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [reload]);

  if (!state) return <p className="pad">Loading…</p>;

  return (
    <div>
      <header>
        <h1>⚡ EasyApply</h1>
        <nav>
          {(
            [
              ['fill', 'Fill'],
              ['profile', 'Profile'],
              ['answers', `Answers (${state.answers.length})`],
              ['applied', `Applied (${state.applications.length})`],
              ['backup', 'Backup'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="pad">
        {tab === 'fill' && <FillTab state={state} />}
        {tab === 'profile' && <ProfileTab state={state} />}
        {tab === 'answers' && <AnswersTab answers={state.answers} />}
        {tab === 'applied' && <AppliedTab apps={state.applications} />}
        {tab === 'backup' && <BackupTab state={state} />}
      </main>
    </div>
  );
}

function FillTab({ state }: { state: AppState }) {
  const [msg, setMsg] = useState('');
  const fill = async () => {
    setMsg('Filling…');
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (t?.id === undefined) return setMsg('No active tab.');
    try {
      const r = (await chrome.tabs.sendMessage(t.id, { type: FILL_MESSAGE })) as FillResult | undefined;
      if (!r) return setMsg('No application form found on this page.');
      if (r.error) return setMsg(`Error: ${r.error}`);
      setMsg(`Filled ${r.filled}, kept ${r.kept}, ${r.needs} need you. Review on the page, then submit yourself.`);
    } catch {
      setMsg('No form found here. If you just installed or updated EasyApply, reload the page and try again.');
    }
  };
  return (
    <section className="stack">
      <button className="primary big" onClick={fill}>
        Autofill this page
      </button>
      <p className="muted">Shortcut: Alt+Shift+F. Or use the ⚡ button that appears on application pages.</p>
      {msg && <p className="msg">{msg}</p>}
      {!state.resume && <p className="warn">No resume uploaded yet. Add it in the Profile tab so file fields get filled.</p>}
      <div className="card">
        <b>How it works</b>
        <ol>
          <li>Opens a job's application form and click Autofill.</li>
          <li>Blue = profile, purple = default rule, green = saved answer, red = needs you.</li>
          <li>Fill the red ones, press <b>Save all answers</b> (or + on a single field). Next time they fill themselves.</li>
          <li>Review everything and click the site's Submit yourself. EasyApply never submits.</li>
        </ol>
      </div>
    </section>
  );
}

function ProfileTab({ state }: { state: AppState }) {
  const [p, setP] = useState<Profile>(state.profile);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Profile, v: string) => {
    setSaved(false);
    setP((cur) => ({ ...cur, [k]: k === 'pastCompanies' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v }));
  };
  const onResume = async (file: File | undefined) => {
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    await saveResume({ name: file.name, type: file.type, data: btoa(bin) });
  };
  return (
    <section className="stack">
      <div className="card">
        <b>Resume</b>
        <p className="muted">{state.resume ? `Saved: ${state.resume.name}` : 'Not uploaded'}</p>
        <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => void onResume(e.target.files?.[0])} />
      </div>
      {(Object.keys(PROFILE_LABELS) as (keyof Profile)[]).map((k) => (
        <label key={k} className="field">
          <span>{PROFILE_LABELS[k]}</span>
          <input
            value={Array.isArray(p[k]) ? (p[k] as string[]).join(', ') : (p[k] as string)}
            onChange={(e) => set(k, e.target.value)}
          />
        </label>
      ))}
      <button
        className="primary"
        onClick={async () => {
          await saveProfile(p);
          setSaved(true);
        }}
      >
        {saved ? 'Saved ✓' : 'Save profile'}
      </button>
    </section>
  );
}

function AnswersTab({ answers }: { answers: SavedAnswer[] }) {
  const [q, setQ] = useState('');
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');
  const shown = answers
    .filter((a) => `${a.question} ${a.answer}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const update = (id: string, patch: Partial<SavedAnswer>) =>
    void saveAnswers(answers.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a)));
  return (
    <section className="stack">
      <p className="muted">Answers you saved with +. {'{company}'} is replaced with the hiring company's name.</p>
      <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="card stack">
        <b>Add an answer</b>
        <input placeholder="Question, e.g. Why do you want to join {company}?" value={newQ} onChange={(e) => setNewQ(e.target.value)} />
        <textarea rows={3} placeholder="Answer" value={newA} onChange={(e) => setNewA(e.target.value)} />
        <button
          disabled={!newQ.trim() || !newA.trim()}
          onClick={() => {
            void saveAnswers([...answers, { id: uid(), question: newQ.trim(), answer: newA.trim(), uses: 0, updatedAt: Date.now() }]);
            setNewQ('');
            setNewA('');
          }}
        >
          Add
        </button>
      </div>
      {shown.map((a) => (
        <div key={a.id} className="card stack">
          <input value={a.question} onChange={(e) => update(a.id, { question: e.target.value })} />
          <textarea rows={2} value={a.answer} onChange={(e) => update(a.id, { answer: e.target.value })} />
          <div className="row">
            <span className="muted">used {a.uses}×</span>
            <button className="danger" onClick={() => void saveAnswers(answers.filter((x) => x.id !== a.id))}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function AppliedTab({ apps }: { apps: Application[] }) {
  const setStatus = (id: string, status: Application['status']) =>
    void saveApplications(apps.map((a) => (a.id === id ? { ...a, status } : a)));
  const csv = () => {
    const rows = [['Date', 'Company', 'Role', 'Status', 'URL'], ...apps.map((a) => [new Date(a.appliedAt).toISOString().slice(0, 10), a.company, a.title, a.status, a.url])];
    const text = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    download('applications.csv', text, 'text/csv');
  };
  return (
    <section className="stack">
      <button onClick={csv} disabled={!apps.length}>
        Export CSV
      </button>
      {!apps.length && <p className="muted">Applications are logged when you submit a form EasyApply filled, or press "Mark applied".</p>}
      {apps.map((a) => (
        <div key={a.id} className="card">
          <div className="row">
            <b>{a.company || 'Unknown company'}</b>
            <span className="muted">{new Date(a.appliedAt).toLocaleDateString()}</span>
          </div>
          <a href={a.url} target="_blank" rel="noreferrer">
            {a.title || a.url}
          </a>
          <div className="row">
            <select value={a.status} onChange={(e) => setStatus(a.id, e.target.value as Application['status'])}>
              <option value="applied">Applied</option>
              <option value="interview">Interview</option>
              <option value="rejected">Rejected</option>
              <option value="offer">Offer</option>
            </select>
            <button className="danger" onClick={() => void saveApplications(apps.filter((x) => x.id !== a.id))}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function BackupTab({ state }: { state: AppState }) {
  const [msg, setMsg] = useState('');
  return (
    <section className="stack">
      <p className="muted">
        Everything is stored in this browser and survives restarts. Export a backup to keep it safe or move it to another computer.
      </p>
      <button className="primary" onClick={() => download(`easyapply-backup-${new Date().toISOString().slice(0, 10)}.json`, exportJson(state), 'application/json')}>
        Export backup (JSON)
      </button>
      <label className="field">
        <span>Import backup</span>
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              await importJson(await f.text());
              setMsg('Imported ✓');
            } catch (err) {
              setMsg(`Import failed: ${String(err)}`);
            }
          }}
        />
      </label>
      {msg && <p className="msg">{msg}</p>}
    </section>
  );
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
