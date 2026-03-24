"use client";

import { useEffect, useState } from "react";

export function TvFullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    update();
    document.addEventListener("fullscreenchange", update);
    return () => {
      document.removeEventListener("fullscreenchange", update);
    };
  }, []);

  async function handleClick() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      // Ignore fullscreen API errors. The menu action is best-effort.
    }
  }

  return (
    <button
      className="dashboard-shell__menu-link w-full rounded-xl bg-[#f7f3ee] px-3 py-2.5 text-left text-sm text-[#00363e] transition hover:bg-[#fa6e18] hover:text-white 3xl:px-4 3xl:py-3.5 3xl:text-[1rem] 4xl:text-[1.08rem] 5xl:px-4.5 5xl:py-4 5xl:text-[1.16rem]"
      onClick={handleClick}
      type="button"
    >
      <div className="font-black">{isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}</div>
    </button>
  );
}
