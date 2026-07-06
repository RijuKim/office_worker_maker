import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home page scaffold", () => {
  it("renders the Korean literary play surface with character details and choices", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<Home />);
    });

    const headings = Array.from(container.querySelectorAll("h1, h2, h3")).map((heading) => heading.textContent);
    const buttons = Array.from(container.querySelectorAll("button")).map((button) => button.textContent ?? "");

    expect(headings).toContain("한서윤");
    expect(container.textContent).toMatch(/사회학과 2학년/);
    expect(container.textContent).toContain("커리어와 엔딩 기록");
    expect(buttons.some((label) => /인턴 이야기를 더 물어본다/.test(label))).toBe(true);
    expect(container.textContent).toMatch(/기업, 인물, 사건은 허구 및 패러디/);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
