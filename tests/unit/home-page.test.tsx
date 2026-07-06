import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home page scaffold", () => {
  it("renders the Korean literary play surface with character details and choices", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "한서윤" })).toBeVisible();
    expect(screen.getByText(/사회학과 2학년/)).toBeVisible();
    expect(screen.getByText("커리어와 엔딩 기록")).toBeVisible();
    expect(screen.getByRole("button", { name: /인턴 이야기를 더 물어본다/ })).toBeVisible();
    expect(screen.getByText(/기업, 인물, 사건은 허구 및 패러디/)).toBeVisible();
  });
});
