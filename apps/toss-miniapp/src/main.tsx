import { StrictMode } from "react";
import { useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
// Load the exact same global/Tailwind stylesheet as the production Next app.
// The Toss bundle uses a responsive wrapper, but its visual tokens and utility
// classes must come from the same source as Vercel.
import "../../../app/globals.css";
import "./theme.css";
import { createTossSafeAreaPort } from "./toss-host";

const safeAreaPort = createTossSafeAreaPort();

function applySafeAreaInsets(top: number, right: number, bottom: number, left: number) {
  const root = document.documentElement;
  root.style.setProperty("--safe-area-top", `${top}px`);
  root.style.setProperty("--safe-area-right", `${right}px`);
  root.style.setProperty("--safe-area-bottom", `${bottom}px`);
  root.style.setProperty("--safe-area-left", `${left}px`);
}

function TossShell() {
  useLayoutEffect(() => {
    const insets = safeAreaPort.get();
    applySafeAreaInsets(insets.top, insets.right, insets.bottom, insets.left);
    return safeAreaPort.subscribe((insets) => {
      applySafeAreaInsets(insets.top, insets.right, insets.bottom, insets.left);
    });
  }, []);

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TossShell />
  </StrictMode>,
);
