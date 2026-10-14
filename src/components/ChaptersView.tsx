import React, { useState } from 'react';
import { BoardState, Chapter, SubjectName } from '../types';
import {
  activeSubs,
  fmtDate,
  fmtLen,
  fmtMin,
  getSubjStats,
  parseLen,
  parts,
  totalMin,
} from '../planner';
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  ChevronRight,
  ClipboardPaste,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

interface ChaptersViewProps {
  S: BoardState;
  updateState: (fn: (draft: BoardState) => void, rebuild?: boolean) => void;
  onOpenBulk: (sub: SubjectName) => void;
  onOpenMove: (id: string) => void;
}

export const ChaptersView: React.FC<ChaptersViewProps> = ({
  S,
  updateState,
  onOpenBulk,
  onOpenMove,
}) => {
  const subs = activeSubs(S);
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({
    [subs[0]]: true,
  });
  const [selectedSub, setSelectedSub] = useState<SubjectName>(subs[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [armedDel, setArmedDel] = useState<string | null>(null);
  const [newChName, setNewChName] = useState<Record<string, string>>({});
  const [newChPos, setNewChPos] = useState<Record<string, string>>({});

  const activeSelectedSub = subs.includes(selectedSub) ? selectedSub : subs[0];

  const handleMoveOrder = (id: string, dir: number) => {
    updateState((d) => {
      const c = d.chapters.find((x) => x.id === id);
      if (!c) return;
      const idxs: number[] = [];
      d.chapters.forEach((x, i) => {
        if (x.subject === c.subject) idxs.push(i);
      });
      const p = idxs.indexOf(d.chapters.indexOf(c));
      const q = p + dir;
      if (p < 0 || q < 0 || q >= idxs.length) return;
      const a = idxs[p];
      const b = idxs[q];
      const tmp = d.chapters[a];
      d.chapters[a] = d.chapters[b];
      d.chapters[b] = tmp;
    }, true);
  };

  const handleAddChapter = (sub: SubjectName) => {
    const name = (newChName[sub] || '').trim();
    if (!name) return;
    const pos = newChPos[sub] || 'end';
    updateState((d) => {
      const ch: Chapter = {
        id: 'c' + d.nextId++,
        subject: sub,
        name,
        num: 0,
        secs: 0,
        done: false,
        doneMin: 0,
        test: '',
        pin: null,
      };
      let idx = -1;
      if (pos === 'start') {
        idx = d.chapters.findIndex((x) => x.subject === sub);
      } else if (pos.startsWith('after:')) {
        const targetId = pos.slice(6);
        const found = d.chapters.findIndex((x) => x.id === targetId);
        if (found > -1) idx = found + 1;
      } else {
        for (let i = d.chapters.length - 1; i >= 0; i--) {
          if (d.chapters[i].subject === sub) {
            idx = i + 1;
            break;
          }
        }
      }
      if (idx < 0) idx = d.chapters.length;
      d.chapters.splice(idx, 0, ch);
    }, true);
    setNewChName((prev) => ({ ...prev, [sub]: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {S.stream}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-1">Chapters</h1>
          <p className="text-sm sm:text-base text-[var(--muted)] mt-1">
            Study time for each chapter is the video time at your speed, plus note-taking,
            plus time to understand.
          </p>
        </div>

        {/* Live Search Filter */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-4 h-4 text-[var(--muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            placeholder="Filter chapters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[42px] pl-9 pr-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm"
          />
        </div>
      </div>

      {/* Desktop View: Master-Detail Subject Switcher + Chapter Editor */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Subject List */}
        <aside className="lg:col-span-4 space-y-2.5 sticky top-20">
          {subs.map((s) => {
            const ss = getSubjStats(S, s);
            const active = activeSelectedSub === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSub(s)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--edge)]'
                }`}
              >
                <div>
                  <div className="font-display text-lg font-bold">{s}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5 tabnum">
                    {ss.done} of {ss.n} done
                    {ss.missing > 0 ? ` · ${ss.missing} need length` : ''}
                  </div>
                </div>
                <ChevronRight
                  className={`w-5 h-5 ${
                    active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                  }`}
                />
              </button>
            );
          })}
        </aside>

        {/* Right Subject Detail Panel */}
        <div className="lg:col-span-8 bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-6">
          <SubjectBody
            S={S}
            sub={activeSelectedSub}
            searchQuery={searchQuery}
            armedDel={armedDel}
            setArmedDel={setArmedDel}
            newChName={newChName[activeSelectedSub] || ''}
            setNewChName={(v) => setNewChName((p) => ({ ...p, [activeSelectedSub]: v }))}
            newChPos={newChPos[activeSelectedSub] || 'end'}
            setNewChPos={(v) => setNewChPos((p) => ({ ...p, [activeSelectedSub]: v }))}
            updateState={updateState}
            onOpenBulk={onOpenBulk}
            onOpenMove={onOpenMove}
            onMoveOrder={handleMoveOrder}
            onAddChapter={() => handleAddChapter(activeSelectedSub)}
          />
        </div>
      </div>

      {/* Mobile & Tablet View: Expandable Subject Accordions */}
      <div className="lg:hidden space-y-4">
        {subs.map((s) => {
          const ss = getSubjStats(S, s);
          const isOpen = Boolean(openSubs[s]) || Boolean(searchQuery.trim());
          return (
            <section
              key={s}
              className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl overflow-hidden"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenSubs((prev) => ({ ...prev, [s]: !prev[s] }))}
                className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left"
              >
                <div>
                  <span className="font-display text-lg font-bold block">{s}</span>
                  <span className="text-xs text-[var(--muted)] tabnum">
                    {ss.done} of {ss.n} done
                    {ss.missing > 0 ? ` · ${ss.missing} need a length` : ''}
                  </span>
                </div>
                <ChevronRight
                  className={`w-5 h-5 text-[var(--muted)] transition-transform ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-2 border-t border-[var(--line)]">
                  <SubjectBody
                    S={S}
                    sub={s}
                    searchQuery={searchQuery}
                    armedDel={armedDel}
                    setArmedDel={setArmedDel}
                    newChName={newChName[s] || ''}
                    setNewChName={(v) => setNewChName((p) => ({ ...p, [s]: v }))}
                    newChPos={newChPos[s] || 'end'}
                    setNewChPos={(v) => setNewChPos((p) => ({ ...p, [s]: v }))}
                    updateState={updateState}
                    onOpenBulk={onOpenBulk}
                    onOpenMove={onOpenMove}
                    onMoveOrder={handleMoveOrder}
                    onAddChapter={() => handleAddChapter(s)}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

interface SubjectBodyProps {
  S: BoardState;
  sub: SubjectName;
  searchQuery: string;
  armedDel: string | null;
  setArmedDel: React.Dispatch<React.SetStateAction<string | null>>;
  newChName: string;
  setNewChName: (v: string) => void;
  newChPos: string;
  setNewChPos: (v: string) => void;
  updateState: (fn: (draft: BoardState) => void, rebuild?: boolean) => void;
  onOpenBulk: (sub: SubjectName) => void;
  onOpenMove: (id: string) => void;
  onMoveOrder: (id: string, dir: number) => void;
  onAddChapter: () => void;
}

const SubjectBody: React.FC<SubjectBodyProps> = ({
  S,
  sub,
  searchQuery,
  armedDel,
  setArmedDel,
  newChName,
  setNewChName,
  newChPos,
  setNewChPos,
  updateState,
  onOpenBulk,
  onOpenMove,
  onMoveOrder,
  onAddChapter,
}) => {
  const allSubChapters = S.chapters.filter((c) => c.subject === sub);
  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? allSubChapters.filter((c) => c.name.toLowerCase().includes(q))
    : allSubChapters;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-2">
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-semibold block" htmlFor={`pl-${sub}`}>
            {sub} playlist link (optional)
          </label>
          <input
            id={`pl-${sub}`}
            type="url"
            inputMode="url"
            placeholder="https://youtube.com/playlist?list=..."
            value={S.playlists[sub] || ''}
            onChange={(e) => {
              const val = e.target.value;
              updateState((d) => {
                d.playlists[sub] = val;
              });
            }}
            className="w-full min-h-[42px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => onOpenBulk(sub)}
          className="min-h-[42px] px-4 rounded-xl border border-[var(--line)] text-xs sm:text-sm font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)] inline-flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <ClipboardPaste className="w-4 h-4" />
          Paste all lengths at once
        </button>
      </div>

      <div className="divide-y divide-[var(--line)]">
        {filtered.map((c) => {
          const idx = allSubChapters.indexOf(c);
          return (
            <EditableChapterRow
              key={c.id}
              S={S}
              c={c}
              isFirst={idx === 0}
              isLast={idx === allSubChapters.length - 1}
              isArmed={armedDel === c.id}
              onToggleDone={(checked) =>
                updateState((d) => {
                  const target = d.chapters.find((x) => x.id === c.id);
                  if (target) {
                    target.done = checked;
                    target.doneMin = checked ? totalMin(d, target) : 0;
                  }
                }, true)
              }
              onRename={(name) =>
                updateState((d) => {
                  const target = d.chapters.find((x) => x.id === c.id);
                  if (target && name.trim()) target.name = name.trim();
                })
              }
              onChangeLen={(secs) =>
                updateState((d) => {
                  const target = d.chapters.find((x) => x.id === c.id);
                  if (target) target.secs = secs;
                }, true)
              }
              onMoveOrder={(dir) => onMoveOrder(c.id, dir)}
              onOpenMove={() => onOpenMove(c.id)}
              onDelete={() => {
                if (armedDel === c.id) {
                  updateState((d) => {
                    d.chapters = d.chapters.filter((x) => x.id !== c.id);
                  }, true);
                  setArmedDel(null);
                } else {
                  setArmedDel(c.id);
                  setTimeout(() => {
                    setArmedDel((cur) => (cur === c.id ? null : cur));
                  }, 4000);
                }
              }}
            />
          );
        })}
      </div>

      {/* Add Chapter Box */}
      <div className="pt-3 border-t border-[var(--line)] space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Add chapter to {sub}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <input
            className="sm:col-span-6 min-h-[42px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm"
            placeholder="Add a chapter"
            aria-label="New chapter name"
            value={newChName}
            onChange={(e) => setNewChName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddChapter();
              }
            }}
          />
          <select
            className="sm:col-span-4 min-h-[42px] px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm"
            aria-label="Where to put the new chapter"
            value={newChPos}
            onChange={(e) => setNewChPos(e.target.value)}
          >
            <option value="end">At the end</option>
            <option value="start">At the start</option>
            {allSubChapters.map((x) => (
              <option key={x.id} value={`after:${x.id}`}>
                After: {x.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onAddChapter}
            className="sm:col-span-2 min-h-[42px] px-4 rounded-xl border border-[var(--line)] text-[var(--accent)] font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[var(--surface-2)]"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

interface EditableChapterRowProps {
  S: BoardState;
  c: Chapter;
  isFirst: boolean;
  isLast: boolean;
  isArmed: boolean;
  onToggleDone: (checked: boolean) => void;
  onRename: (name: string) => void;
  onChangeLen: (secs: number) => void;
  onMoveOrder: (dir: number) => void;
  onOpenMove: () => void;
  onDelete: () => void;
}

const EditableChapterRow: React.FC<EditableChapterRowProps> = ({
  S,
  c,
  isFirst,
  isLast,
  isArmed,
  onToggleDone,
  onRename,
  onChangeLen,
  onMoveOrder,
  onOpenMove,
  onDelete,
}) => {
  const [nameDraft, setNameDraft] = useState(c.name);
  const [lenDraft, setLenDraft] = useState(fmtLen(c.secs));

  React.useEffect(() => {
    setNameDraft(c.name);
  }, [c.name]);

  React.useEffect(() => {
    setLenDraft(fmtLen(c.secs));
  }, [c.secs]);

  const b = parts(S, c);

  return (
    <div className="py-4 space-y-2.5">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 items-center">
        <label className="inline-flex items-center justify-center w-9 h-9 cursor-pointer" title="Completed">
          <input
            type="checkbox"
            checked={c.done}
            onChange={(e) => onToggleDone(e.target.checked)}
            aria-label={`Completed: ${c.name}`}
            className="w-5 h-5 accent-[var(--accent)] rounded"
          />
        </label>
        <input
          aria-label="Chapter name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            if (nameDraft.trim()) onRename(nameDraft);
            else setNameDraft(c.name);
          }}
          className={`w-full min-h-[42px] px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-medium ${
            c.done ? 'text-[var(--muted)]' : 'text-[var(--fg)]'
          }`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pl-11">
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="h:mm:ss"
          aria-label="Video length"
          value={lenDraft}
          onChange={(e) => setLenDraft(e.target.value)}
          onBlur={() => {
            const secs = parseLen(lenDraft);
            onChangeLen(secs);
            setLenDraft(fmtLen(secs));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const secs = parseLen(lenDraft);
              onChangeLen(secs);
              setLenDraft(fmtLen(secs));
              e.currentTarget.blur();
            }
          }}
          className="w-32 min-h-[40px] px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] font-mono-num text-sm"
        />
        <span className="text-xs text-[var(--muted)] tabnum">
          {!(c.secs > 0) ? (
            'Add a length to include it in the plan.'
          ) : (
            <>
              Watch {fmtMin(b.w)} + Notes {fmtMin(b.n)} + Practice {fmtMin(b.p)} ={' '}
              <b className="text-[var(--fg)]">{fmtMin(totalMin(S, c))}</b>
            </>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-11">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onMoveOrder(-1)}
          aria-label={`Move up: ${c.name}`}
          className="w-9 h-9 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--fg)] disabled:opacity-35 hover:bg-[var(--surface-2)]"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => onMoveOrder(1)}
          aria-label={`Move down: ${c.name}`}
          className="w-9 h-9 rounded-xl border border-[var(--line)] flex items-center justify-center text-[var(--fg)] disabled:opacity-35 hover:bg-[var(--surface-2)]"
        >
          <ArrowDown className="w-4 h-4" />
        </button>

        {!c.done && (
          <button
            type="button"
            onClick={onOpenMove}
            className="min-h-[36px] px-3 rounded-xl border border-[var(--line)] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[var(--surface-2)]"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Move or test date
          </button>
        )}

        {c.test && (
          <span className="text-xs font-semibold text-[var(--warn)] px-2">
            Test {fmtDate(c.test, { day: 'numeric', month: 'short' })}
          </span>
        )}

        <button
          type="button"
          onClick={onDelete}
          className="min-h-[36px] px-3 rounded-xl border border-[var(--line)] text-xs font-semibold text-[var(--bad)] inline-flex items-center gap-1.5 hover:bg-[var(--bad-soft)]"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {isArmed ? 'Tap again to delete' : 'Delete'}
        </button>
      </div>
    </div>
  );
};
