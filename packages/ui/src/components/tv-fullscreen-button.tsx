"use client";

import { useEffect, useState } from "react";

type TvFullscreenButtonProps = {
  variant?: "action" | "icon";
};

export function TvFullscreenButton({
  variant = "action",
}: TvFullscreenButtonProps) {
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

  const label = isFullscreen ? "Exit fullscreen" : "Enter fullscreen";

  if (variant === "icon") {
    return (
      <button
        aria-label={label}
        aria-pressed={isFullscreen}
        className="dashboard-shell__fullscreen-button flex shrink-0 items-center justify-center border border-[#e6ddd2] bg-white font-black text-[#00363e] shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition hover:border-[#0b4d5a] hover:bg-[#0b4d5a] hover:text-white"
        data-active={isFullscreen ? "true" : "false"}
        onClick={handleClick}
        title={label}
        type="button"
      >
        <span aria-hidden="true" className="dashboard-shell__fullscreen-icon">
          ⛶
        </span>
        <span className="sr-only">{label}</span>
      </button>
    );
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
