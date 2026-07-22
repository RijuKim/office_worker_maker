import { StrictMode } from "react";
import { useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "../../../lib/game-ui/styles.css";
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
