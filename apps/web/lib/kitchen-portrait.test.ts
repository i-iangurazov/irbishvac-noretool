import { describe, expect, it } from "vitest";
import { kitchenPortraitFrame, kitchenPortraitKey } from "./kitchen-portrait";

describe("kitchen portrait framing", () => {
  it("keeps a face low in a tall photo inside the frame", () => {
    const focus = { x: 0.35, y: 0.58, width: 0.25, height: 0.16 };
    const crop = kitchenPortraitFrame(
      { width: 1170, height: 2532 },
      { width: 410, height: 510 },
      focus,
    )!;
    const top = crop.top + focus.y * crop.height;
    const bottom = top + focus.height * crop.height;
    expect(top).toBeGreaterThan(0);
    expect(bottom).toBeLessThan(510);
    expect((top + bottom) / 2).toBeGreaterThanOrEqual(510 * 0.44);
    expect((top + bottom) / 2).toBeLessThan(510 * 0.55);
  });

  it("preserves headroom above a close-up face on a wide celebration card", () => {
    const focus = { x: 0.33, y: 0.247, width: 0.392, height: 0.314 };
    const crop = kitchenPortraitFrame(
      { width: 1122, height: 1402 },
      { width: 574, height: 445 },
      focus,
    )!;
    expect(
      crop.top + (focus.y - focus.height * 0.65) * crop.height,
    ).toBeGreaterThanOrEqual(445 * 0.05 - 0.001);
    expect(crop.top + (focus.y + focus.height) * crop.height).toBeLessThan(445);
  });

  it("uses the same framing for equivalent face positions at different resolutions", () => {
    const focus = { x: 0.3, y: 0.2, width: 0.3, height: 0.25 };
    const frame = { width: 400, height: 500 };
    expect(
      kitchenPortraitFrame({ width: 1200, height: 1600 }, frame, focus),
    ).toEqual(
      kitchenPortraitFrame({ width: 2400, height: 3200 }, frame, focus),
    );
  });

  it("fills the frame without exposing the image edge when the face is near a boundary", () => {
    const crop = kitchenPortraitFrame(
      { width: 1600, height: 1200 },
      { width: 400, height: 500 },
      { x: 0.05, y: 0.05, width: 0.25, height: 0.3 },
    )!;
    expect(crop.left).toBeLessThanOrEqual(0);
    expect(crop.top).toBeLessThanOrEqual(0);
    expect(crop.left + crop.width).toBeGreaterThanOrEqual(400);
    expect(crop.top + crop.height).toBeGreaterThanOrEqual(500);
  });

  it("keeps the complete photo visible if its framing is unknown", () => {
    const crop = kitchenPortraitFrame(
      { width: 1600, height: 900 },
      { width: 400, height: 500 },
      null,
    )!;
    expect(crop.width).toBe(400);
    expect(crop.height).toBe(225);
    expect(crop.top).toBe(137.5);
  });

  it("ties framing to the source image rather than its employee or temporary URL signature", () => {
    const original = "https://photos.example.com/one.jpg?signature=old";
    expect(kitchenPortraitKey(original)).toBe(
      kitchenPortraitKey("https://photos.example.com/one.jpg?signature=new"),
    );
    expect(kitchenPortraitKey(original)).toBe(
      kitchenPortraitKey(
        `/_next/image?url=${encodeURIComponent(original)}&w=1200&q=82`,
      ),
    );
    expect(kitchenPortraitKey(original)).not.toBe(
      kitchenPortraitKey("https://photos.example.com/replacement.jpg"),
    );
  });
});
