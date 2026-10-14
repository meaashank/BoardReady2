import React, { useEffect, useState } from 'react';
import {
  BoardState,
  BulkVideoItem,
  NOTE_LINES,
  NOTE_SIGN,
  NOTE_TITLE,
  SubjectName,
} from '../types';
import {
  activeChapters,
  addDays,
  chOf,
  fmtDate,
  fmtMin,
  getPlannedDate,
  parseBulkPlaylist,
  remainMin,
  todayStr,
} from '../planner';
import { X } from 'lucide-react';

export type SheetState =
  | null
  | { type: 'add' }
  | { type: 'note' }
  | { type: 'move'; id: string }
  | { type: 'bulk'; sub: SubjectName };

interface SheetsProps {
  S: BoardState;
  sheet: SheetState;
  onClose: () => void;
  onMoveChapter: (id: string, date: string, time: string) => void;
  onClearPin: (id: string) => void;
  onSaveTestDate: (id: string, testDate: string) => void;
  onApplyBulk: (sub: SubjectName, sums: Record<string, number>, skipDone: boolean) => void;
}

export const Sheets: React.FC<SheetsProps> = ({
  S,
  sheet,
  onClose,
  onMoveChapter,
  onClearPin,
  onSaveTestDate,
  onApplyBulk,
}) => {
  useEffect(() => {
    if (!sheet) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [sheet, onClose]);

  if (!sheet) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--scrim)] backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Sheet / Dialog Box */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg bg-[var(--surface)] border border-[var(--line)] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 pb-[calc(22px+env(safe-area-inset-bottom,0px))] sm:pb-6 max-h-[88vh] overflow-y-auto flex flex-col gap-4 shadow-2xl"
      >
        {/* Mobile grab handle */}
        <div className="w-10 h-1.5 rounded-full bg-[var(--line)] mx-auto -mt-1 mb-1 sm:hidden" />

        {sheet.type === 'add' && (
          <AddTodaySheet S={S} onClose={onClose} onMoveChapter={onMoveChapter} />
        )}

        {sheet.type === 'note' && <NoteSheet onClose={onClose} />}

        {sheet.type === 'move' && (
          <MoveSheet
            S={S}
            id={sheet.id}
            onClose={onClose}
            onMoveChapter={onMoveChapter}
            onClearPin={onClearPin}
            onSaveTestDate={onSaveTestDate}
          />
        )}

        {sheet.type === 'bulk' && (
          <BulkPasteSheet
            S={S}
            sub={sheet.sub}
            onClose={onClose}
            onApplyBulk={onApplyBulk}
          />
        )}
      </div>
    </div>
  );
};

/* ---------- 1. Add to Today Sheet ---------- */
const AddTodaySheet: React.FC<{
  S: BoardState;
  onClose: () => void;
  onMoveChapter: (id: string, date: string, time: string) => void;
}> = ({ S, onClose, onMoveChapter }) => {
  const [q, setQ] = useState('');
  const T = todayStr();
  const inToday: Record<string, number> = {};
  (S.sched[T] || []).forEach((it) => {
    inToday[it.c] = 1;
  });

  const query = q.toLowerCase();
  const list = activeChapters(S)
    .filter(
      (c) =>
        !c.done &&
        c.secs > 0 &&
        !inToday[c.id] &&
        (c.name.toLowerCase().includes(query) ||
          c.subject.toLowerCase().includes(query))
    )
    .slice(0, 40);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Add to today</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <input
        type="search"
        autoFocus
        placeholder="Search by chapter or subject"
        aria-label="Search chapters"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full min-h-[46px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm"
      />

      <div className="divide-y divide-[var(--line)] max-h-[50vh] overflow-y-auto">
        {list.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">
            No matching chapters with a video length.
          </p>
        ) : (
          list.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onMoveChapter(c.id, T, '');
                onClose();
              }}
              className="w-full py-3 px-2 text-left flex flex-col gap-0.5 hover:bg-[var(--surface-2)] rounded-lg transition-colors"
            >
              <b className="font-semibold text-sm sm:text-base leading-snug">{c.name}</b>
              <span className="text-xs text-[var(--muted)] tabnum">
                {c.subject} · {fmtMin(remainMin(S, c))}
              </span>
            </button>
          ))
        )}
      </div>
    </>
  );
};

/* ---------- 2. Note Sheet ---------- */
const NoteSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">{NOTE_TITLE}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3 text-base leading-relaxed">
        {NOTE_LINES.map((p, idx) => (
          <p key={idx}>{p}</p>
        ))}
      </div>

      <p className="font-display text-lg font-semibold text-[var(--accent)] pt-1">
        {NOTE_SIGN}
      </p>

      <button
        type="button"
        onClick={onClose}
        className="w-full min-h-[48px] rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-base mt-2"
      >
        Close
      </button>
    </>
  );
};

/* ---------- 3. Move / Test Date Sheet ---------- */
const MoveSheet: React.FC<{
  S: BoardState;
  id: string;
  onClose: () => void;
  onMoveChapter: (id: string, date: string, time: string) => void;
  onClearPin: (id: string) => void;
  onSaveTestDate: (id: string, testDate: string) => void;
}> = ({ S, id, onClose, onMoveChapter, onClearPin, onSaveTestDate }) => {
  const c = chOf(S, id);
  const T = todayStr();
  const pd = c ? getPlannedDate(S, c.id) : '';
  const defaultDate = c?.pin
    ? c.pin.date
    : pd && pd > T
    ? pd
    : addDays(T, 1);

  const [mvDate, setMvDate] = useState(defaultDate);
  const [mvTime, setMvTime] = useState(c?.pin ? c.pin.time : '');
  const [mvTest, setMvTest] = useState(c?.test || '');

  if (!c) return null;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {c.subject}
          </div>
          <h2 className="font-display text-xl font-bold mt-0.5 break-words">{c.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)] shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {pd && (
        <p className="text-xs sm:text-sm text-[var(--muted)]">
          Planned for {fmtDate(pd, { weekday: 'long', day: 'numeric', month: 'long' })}
          {c.pin ? ' (set by you)' : ''}.
        </p>
      )}

      {!c.done && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold block" htmlFor="mvdate">
                Move to date
              </label>
              <input
                id="mvdate"
                type="date"
                min={T}
                value={mvDate}
                onChange={(e) => setMvDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-mono-num"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold block" htmlFor="mvtime">
                Time of day (optional)
              </label>
              <input
                id="mvtime"
                type="time"
                value={mvTime}
                onChange={(e) => setMvTime(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-mono-num"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (mvDate && mvDate >= T) {
                  onMoveChapter(c.id, mvDate, mvTime);
                  onClose();
                }
              }}
              className="min-h-[46px] px-5 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-sm"
            >
              Move here
            </button>
            {c.pin && (
              <button
                type="button"
                onClick={() => {
                  onClearPin(c.id);
                  onClose();
                }}
                className="min-h-[46px] px-4 rounded-xl border border-[var(--line)] text-[var(--accent)] font-semibold text-sm hover:bg-[var(--surface-2)]"
              >
                Let the plan decide
              </button>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-[var(--line)] pt-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold block" htmlFor="mvtest">
            School test date for this chapter
          </label>
          <input
            id="mvtest"
            type="date"
            value={mvTest}
            onChange={(e) => setMvTest(e.target.value)}
            className="w-full sm:w-60 min-h-[44px] px-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-mono-num"
          />
          <span className="text-xs text-[var(--muted)] block">
            The plan schedules this chapter before the test and keeps that subject free on
            test day.
          </span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onSaveTestDate(c.id, mvTest);
              onClose();
            }}
            className="min-h-[44px] px-4 rounded-xl border border-[var(--line)] text-[var(--accent)] font-semibold text-sm hover:bg-[var(--surface-2)]"
          >
            Save test date
          </button>
          {mvTest && (
            <button
              type="button"
              onClick={() => {
                onSaveTestDate(c.id, '');
                onClose();
              }}
              className="min-h-[44px] px-3 rounded-xl text-xs font-semibold text-[var(--muted)] hover:text-[var(--fg)]"
            >
              Clear test date
            </button>
          )}
        </div>
      </div>
    </>
  );
};

/* ---------- 4. Bulk Paste Sheet ---------- */
const BulkPasteSheet: React.FC<{
  S: BoardState;
  sub: SubjectName;
  onClose: () => void;
  onApplyBulk: (sub: SubjectName, sums: Record<string, number>, skipDone: boolean) => void;
}> = ({ S, sub, onClose, onApplyBulk }) => {
  const [text, setText] = useState('');
  const [skipDone, setSkipDone] = useState(true);
  const [vids, setVids] = useState<BulkVideoItem[]>([]);
  const [note, setNote] = useState('');

  const handleTextChange = (val: string) => {
    setText(val);
    const parsed = parseBulkPlaylist(S, val, sub);
    setVids(parsed.vids);
    setNote(parsed.note);
  };

  const chs = S.chapters.filter((c) => c.subject === sub);
  const matched = vids.filter((x) => x.ch).length;
  const got: Record<string, number> = {};
  vids.forEach((x) => {
    if (x.ch) got[x.ch] = (got[x.ch] || 0) + 1;
  });
  const missing = chs.filter(
    (c) => !(skipDone && c.done) && !got[c.id] && !(c.secs > 0)
  ).length;
  const multi = Object.keys(got).filter((k) => got[k] > 1).length;

  const handleApply = () => {
    const sums: Record<string, number> = {};
    vids.forEach((v) => {
      if (v.ch) sums[v.ch] = (sums[v.ch] || 0) + v.secs;
    });
    if (Object.keys(sums).length > 0) {
      onApplyBulk(sub, sums, skipDone);
      onClose();
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Paste all {sub} lengths</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <ol className="text-xs sm:text-sm text-[var(--muted)] pl-5 list-decimal space-y-1">
        <li>Open your {sub} playlist on YouTube in a browser.</li>
        <li>Select everything on the page (Ctrl+A, or Select all) and copy it.</li>
        <li>
          Paste it below. Board Ready reads each video title and finds the chapter by name
          or number, so the playlist can be in any order.
        </li>
      </ol>

      <textarea
        autoFocus
        rows={5}
        placeholder="Paste the playlist page text here"
        aria-label="Pasted playlist text"
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        className="w-full p-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm leading-relaxed focus:border-[var(--accent)] focus:outline-none"
      />

      <label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted)] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={skipDone}
          onChange={(e) => setSkipDone(e.target.checked)}
          className="w-5 h-5 accent-[var(--accent)] rounded"
        />
        Skip chapters marked completed
      </label>

      <div className="space-y-1 text-xs sm:text-sm">
        {!vids.length ? (
          <p className="text-[var(--muted)]">
            {text.trim()
              ? 'No video lengths found in that text. Make sure you copied the whole playlist page.'
              : 'Nothing pasted yet.'}
          </p>
        ) : (
          <>
            <p>
              <b>{vids.length}</b> video{vids.length > 1 ? 's' : ''} found,{' '}
              <b>{matched}</b> matched to chapters.
            </p>
            {note && <p className="text-[var(--muted)]">{note}</p>}
            {multi > 0 && (
              <p className="text-[var(--muted)]">
                {multi} chapter{multi > 1 ? 's have' : ' has'} more than one video. Their
                lengths are added together.
              </p>
            )}
            {vids.length > matched && (
              <p className="text-[var(--warn)]">
                {vids.length - matched} not matched. Pick a chapter for them below, or leave
                them skipped.
              </p>
            )}
            {missing > 0 && (
              <p className="text-[var(--warn)]">
                {missing} chapter{missing > 1 ? 's' : ''} will still need a length.
              </p>
            )}
          </>
        )}
      </div>

      {vids.length > 0 && (
        <>
          <button
            type="button"
            onClick={handleApply}
            className="w-full min-h-[46px] rounded-xl bg-[var(--accent)] text-[var(--on-accent)] font-semibold text-sm"
          >
            Fill chapter lengths
          </button>

          <div className="divide-y divide-[var(--line)] max-h-[36vh] overflow-y-auto">
            {vids.map((v, i) => {
              let how =
                v.how === 'name'
                  ? 'matched by name'
                  : v.how === 'number'
                  ? 'matched by chapter number (backup)'
                  : v.how === 'you'
                  ? 'chosen by you'
                  : 'not matched, please choose';
              const cc0 = v.ch ? chOf(S, v.ch) : null;
              if (cc0 && skipDone && cc0.done) how += ' (skipped: chapter completed)';

              return (
                <div key={i} className="py-3 space-y-2">
                  <div className="flex flex-col gap-0.5">
                    <b className="text-sm font-semibold leading-snug break-words">
                      {v.title ? v.title.slice(0, 90) : `Video ${i + 1}`}
                    </b>
                    <span className="text-xs text-[var(--muted)] tabnum">
                      {v.d} · {how}
                    </span>
                  </div>
                  <select
                    aria-label={`Chapter for video ${i + 1}`}
                    value={v.ch}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVids((prev) =>
                        prev.map((item, idx) =>
                          idx === i
                            ? { ...item, ch: val, how: val ? 'you' : '' }
                            : item
                        )
                      );
                    }}
                    className="w-full min-h-[40px] px-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xs sm:text-sm"
                  >
                    <option value="">Skip this video</option>
                    {chs.map((c, idx) => (
                      <option key={c.id} value={c.id}>
                        {idx + 1}. {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
};
