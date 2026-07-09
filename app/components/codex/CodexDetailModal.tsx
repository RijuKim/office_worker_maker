"use client";

import { useEffect } from "react";
import { EndingArt } from "@/lib/game/ending-art";
import type { CodexSlot } from "@/lib/game/codex-catalog";
import type { CareerEndingRecord } from "@prisma/client";

interface CodexDetailModalProps {
  slot: CodexSlot;
  unlocked: boolean;
  achievementCount: number;
  firstAchievedAt: Date | null;
  recordSample: CareerEndingRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CodexDetailModal({
  slot,
  unlocked,
  achievementCount,
  firstAchievedAt,
  recordSample,
  isOpen,
  onClose,
}: CodexDetailModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="codex-dialog-title"
    >
      <div
        className="pixel-panel relative flex w-full max-w-md flex-col overflow-y-auto bg-slate-50 p-6 shadow-xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center text-2xl font-bold text-slate-400 hover:text-slate-900"
          aria-label="닫기"
        >
          &times;
        </button>

        <div className="mt-4 flex flex-col items-center text-center">
          {unlocked ? (
            <>
              <EndingArt type={slot.endingArtType} size={160} />
              
              <div className="mt-4 flex flex-col items-center gap-2">
                <span className="rounded bg-slate-800 px-2 py-1 text-xs font-bold text-white">
                  {slot.category}
                </span>
                <h2 id="codex-dialog-title" className="text-2xl font-bold text-slate-900">{slot.title}</h2>
              </div>

              <div className="mt-4 flex gap-4 text-sm font-medium text-slate-600">
                {firstAchievedAt && (
                  <span>
                    최초 달성: {new Date(firstAchievedAt).toISOString().split("T")[0]}
                  </span>
                )}
                <span>{achievementCount}회 달성</span>
              </div>

              {recordSample && (
                <div className="mt-6 w-full rounded border-2 border-slate-200 bg-white p-4 text-left text-sm text-slate-700">
                  <p className="mb-2 font-bold text-slate-900">마지막 기록</p>
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {recordSample.longNarrative
                      ? recordSample.longNarrative.slice(0, 200) +
                        (recordSample.longNarrative.length > 200 ? "..." : "")
                      : recordSample.summary}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <EndingArt type="default" size={160} locked={true} />
              
              <div className="mt-4 flex flex-col items-center gap-2">
                <span className="rounded bg-slate-200 px-2 py-1 text-xs font-bold text-slate-500">
                  {slot.category}
                </span>
                <h2 id="codex-dialog-title" className="text-2xl font-bold text-slate-400">???</h2>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                {slot.categoryHint}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-500">
                특정 조건을 만족하면 해제됩니다.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
