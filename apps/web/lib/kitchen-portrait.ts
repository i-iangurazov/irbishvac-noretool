import focusByImage from "./kitchen-portrait-focus.json";

export type PortraitFocus = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Query signatures can rotate without changing the underlying photo. */
export function kitchenPortraitKey(src: string): string | null {
  try {
    let url = new URL(src, "https://dashboard.invalid");
    if (url.pathname === "/_next/image") {
      const original = url.searchParams.get("url");
      if (!original) return null;
      url = new URL(original);
    }
    let hash = 14695981039346656037n;
    for (const character of url.origin + url.pathname) {
      hash = BigInt.asUintN(
        64,
        (hash ^ BigInt(character.charCodeAt(0))) * 1099511628211n,
      );
    }
    return hash.toString(16).padStart(16, "0");
  } catch {
    return null;
  }
}

export function kitchenPortraitFocus(src: string): PortraitFocus | null {
  const key = kitchenPortraitKey(src);
  return key
    ? ((focusByImage as Record<string, PortraitFocus | null>)[key] ?? null)
    : null;
}

/** Only reviewed non-portrait photos are skipped; a new source remains usable. */
export function kitchenPortraitUsable(src: string): boolean {
  const key = kitchenPortraitKey(src);
  return (
    !key || (focusByImage as Record<string, PortraitFocus | null>)[key] !== null
  );
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Place reviewed face bounds consistently, independent of source photo dimensions. */
export function kitchenPortraitFrame(
  image: { width: number; height: number },
  frame: { width: number; height: number },
  focus: PortraitFocus | null,
) {
  if (Math.min(image.width, image.height, frame.width, frame.height) <= 0)
    return null;
  const cover = Math.max(
    frame.width / image.width,
    frame.height / image.height,
  );
  // A new, unreviewed photo stays entirely visible until its framing is supplied.
  if (!focus) {
    const scale = Math.min(
      frame.width / image.width,
      frame.height / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    return {
      width,
      height,
      left: (frame.width - width) / 2,
      top: (frame.height - height) / 2,
    };
  }
  const faceHeight = focus.height * image.height;
  const faceWidth = focus.width * image.width;
  const target = Math.min(
    (frame.height * 0.38) / faceHeight,
    (frame.width * 0.68) / faceWidth,
  );
  const scale = Math.max(cover, Math.min(target, cover * 4));
  const width = image.width * scale;
  const height = image.height * scale;
  const centerX = (focus.x + focus.width / 2) * width;
  const centerY = (focus.y + focus.height / 2) * height;
  // Close-up source photos need extra headroom in a wide celebration card.
  // Face rectangles stop near the forehead, so reserve space for hair or a hat.
  const headTop = Math.max(0, focus.y - focus.height * 0.65) * height;
  const faceBottom = (focus.y + focus.height) * height;
  const top = Math.min(
    Math.max(frame.height * 0.44 - centerY, frame.height * 0.05 - headTop),
    frame.height * 0.96 - faceBottom,
  );
  return {
    width,
    height,
    left: clamp(frame.width / 2 - centerX, frame.width - width, 0),
    top: clamp(top, frame.height - height, 0),
  };
}
