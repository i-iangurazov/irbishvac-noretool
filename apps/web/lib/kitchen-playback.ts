const KEY = "irbis:kitchen:release-playback";
export function saveKitchenPlayback(state: {
  index: number;
  running: boolean;
}) {
  try {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...state, href: window.location.href, at: Date.now() }),
    );
  } catch {
    /* Storage is optional. */
  }
}
export function readKitchenPlayback(): {
  index: number;
  running: boolean;
} | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
    window.sessionStorage.removeItem(KEY);
    if (
      !value ||
      !Number.isFinite(value.at) ||
      value.href !== window.location.href ||
      Date.now() - value.at > 5 * 60_000 ||
      Date.now() < value.at ||
      !Number.isInteger(value.index) ||
      value.index < 0 ||
      typeof value.running !== "boolean"
    )
      return null;
    return { index: value.index, running: value.running };
  } catch {
    return null;
  }
}
