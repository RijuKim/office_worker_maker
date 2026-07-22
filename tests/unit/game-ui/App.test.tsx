import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENDING_SHARE_COPY_FAILURE_MESSAGE, RecordShareActions, copyEndingShareLink } from "@/lib/game-ui/App";

describe("shared records and share helpers", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders only the allowed record actions and omits x/kakao share controls", () => {
    act(() => {
      root.render(
        <RecordShareActions
          onCopyLink={async () => undefined}
          onSaveImage={async () => undefined}
          recordId="ending-1"
        />,
      );
    });

    expect(container.textContent).toContain("링크 복사");
    expect(container.textContent).toContain("이미지 저장");
    expect(container.textContent).not.toMatch(/카톡 공유|X 공유|𝕏|kakaotalk|twitter/i);
  });

  it("keeps clipboard untouched when share-link creation fails", async () => {
    const createEndingShareLink = vi.fn(async () => {
      throw new Error("share failed");
    });
    const copy = vi.fn(async () => undefined);

    await expect(copyEndingShareLink({
      sharing: { createEndingShareLink },
      clipboard: { copy },
    }, "ending-1")).resolves.toEqual({
      ok: false,
      message: ENDING_SHARE_COPY_FAILURE_MESSAGE,
    });

    expect(createEndingShareLink).toHaveBeenCalledOnce();
    expect(copy).not.toHaveBeenCalled();
  });
});
