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
      className={`tv-settings-modal__action tv-fullscreen-button w-full text-left transition ${
        isFullscreen
          ? "bg-[#0b4d5a] text-white shadow-[0_10px_22px_rgba(11,77,90,0.16)]"
          : "bg-[#f7f3ee] text-[#00363e] hover:bg-[#fa6e18] hover:text-white"
      }`}
      data-active={isFullscreen ? "true" : "false"}
      onClick={handleClick}
      type="button"
    >
      <div className="tv-settings-modal__action-copy">
        <div className="tv-settings-modal__action-title font-black">
          {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        </div>
        <div className="tv-settings-modal__action-description">
          Use the browser fullscreen API for the current display.
        </div>
      </div>
      <div className="tv-settings-modal__action-state">
        {isFullscreen ? "On" : "Open"}
      </div>
    </button>
  );
}
