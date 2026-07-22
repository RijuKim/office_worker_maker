import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ShareNotFound from "@/app/share/[id]/not-found";

describe("public ending share not-found page", () => {
  it("renders the agreed korean 404 message", () => {
    const html = renderToStaticMarkup(<ShareNotFound />);

    expect(html).toContain("기록을 찾을 수 없습니다");
  });
});

