"use client";

import type { CodexSlot } from "@/lib/game/codex-catalog";
import { EndingArt } from "@/lib/game/ending-art";

export interface CodexCardProps {
  slot: CodexSlot;
  unlocked: boolean;
  achievementCount: number;
  firstAchievedAt: Date | null;
  onClick: () => void;
}

export function CodexCard({
  slot,
  unlocked,
  achievementCount,
  firstAchievedAt,
  onClick,
}: CodexCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pixel-panel relative flex h-full w-full flex-col items-center p-5 text-left transition-transform hover:-translate-y-1 focus:-translate-y-1 active:translate-y-0 disabled:pointer-events-none"
    >
      {unlocked && achievementCount > 1 && (
        <span className="absolute right-2 top-2 border-2 border-[#2a2018] bg-[#f7d08b] px-1.5 py-0.5 text-[10px] font-black leading-none text-[#2a2018]">
          ×{achievementCount}
        </span>
      )}

      <div className="mb-4 flex h-20 w-20 items-center justify-center">
        <EndingArt type={slot.endingArtType} size={80} locked={!unlocked} />
      </div>

      <div className="flex w-full flex-1 flex-col items-center justify-start text-center">
        {unlocked ? (
          <>
            <h3 className="break-keep text-sm font-bold leading-tight text-[#2a241e]">
              {slot.title}
            </h3>
            {firstAchievedAt && (
              <p className="mt-2 text-[10px] font-bold text-[#8a4f2d]">
                {new Date(firstAchievedAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}
              </p>
            )}
          </>
        ) : (
          <>
            <h3 className="break-keep text-sm font-black tracking-widest text-[#706b62]">
              ???
            </h3>
            <p className="mt-2 break-keep text-xs leading-tight text-[#a09a8f]">
              {slot.categoryHint}
            </p>
          </>
        )}
      </div>
    </button>
  );
}

export default CodexCard;
