import { PUBLIC_ENDING_NOT_FOUND_MESSAGE } from "@/lib/game-ui/public-ending";

export default function ShareNotFound() {
  return (
    <main className="min-h-screen bg-[#f7efe2] p-4 pt-8 text-[#2a241e]">
      <div className="mx-auto max-w-2xl">
        <div className="pixel-panel border-4 border-[#2a2018] bg-[#fffaf0] p-6 text-center">
          <p className="text-lg font-black">{PUBLIC_ENDING_NOT_FOUND_MESSAGE}</p>
        </div>
      </div>
    </main>
  );
}

