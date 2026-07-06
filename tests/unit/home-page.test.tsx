import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import Home from "@/app/page";

vi.mock("next-auth/react", async () => {
  const actual = await vi.importActual("next-auth/react");
  return {
    ...actual,
    useSession: vi.fn(() => ({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    })),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
});

describe("Home page scaffold", () => {
  it("renders the auth login form when unauthenticated", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<Home />);
    });

    expect(container.textContent).toContain("College Career Sim");
    expect(container.textContent).toContain("로그인");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
