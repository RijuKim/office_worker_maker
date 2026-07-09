"use client";

import { CodexCard } from "@/app/components/codex/CodexCard";
import { CATEGORY_ORDER } from "@/lib/game/codex-catalog";
import type { CodexSlot } from "@/lib/game/codex-catalog";
import type { CodexState } from "@/lib/game/derive-codex-state";

interface CodexGridProps {
  codexState: CodexState;
  onSlotClick: (slot: CodexSlot) => void;
}

export function CodexGrid({ codexState, onSlotClick }: CodexGridProps) {
  const { totalSlots, unlockedCount, byCategory, slots } = codexState;

  return (
    <div className="mx-auto w-full max-w-5xl pb-12">
      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tight text-[#2a241e]">
          {unlockedCount} / {totalSlots} 달성
        </h2>
      </div>

      <div className="space-y-10">
        {CATEGORY_ORDER.map((category) => {
          const catState = byCategory[category];
          if (!catState || catState.total === 0) return null;

          const catSlots = slots.filter((s) => s.slot.category === category);

          return (
            <div className="category-section" key={category}>
              <div className="mb-4 flex items-baseline gap-3 border-b-4 border-[#2a2018] pb-2">
                <h3 className="text-xl font-bold text-[#2a241e]">{category}</h3>
                <span className="text-sm font-bold text-[#8a4f2d]">
                  ({catState.unlocked}/{catState.total})
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {catSlots.map((s) => (
                  <CodexCard
                    achievementCount={s.achievementCount}
                    firstAchievedAt={s.firstAchievedAt}
                    key={s.slot.id}
                    onClick={() => onSlotClick(s.slot)}
                    slot={s.slot}
                    unlocked={s.unlocked}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
