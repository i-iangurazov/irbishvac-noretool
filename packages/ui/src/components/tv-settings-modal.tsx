"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TvFullscreenButton } from "./tv-fullscreen-button";

type TvSettingsModalProps = {
  enabled: boolean;
  toggleHref: string;
  kioskMode?: boolean | undefined;
  kioskHref?: string | undefined;
  rotateMode?: boolean | undefined;
  rotatePreset?: string | undefined;
  rotateOffHref?: string | undefined;
  rotateMtdHref?: string | undefined;
  rotateYtdHref?: string | undefined;
  rotationBoardOptions?: Array<{
    label: string;
    href: string;
    active: boolean;
  }> | undefined;
};

function ActionLink(props: {
  href: string;
  label: string;
  description?: string | undefined;
  active?: boolean;
  onActivate?: (() => void) | undefined;
}) {
  return (
    <a
      className={`tv-settings-modal__action flex items-center font-black transition ${
        props.active
          ? "bg-[#0b4d5a] text-white shadow-[0_10px_22px_rgba(11,77,90,0.16)]"
          : "bg-[#f7f3ee] text-[#00363e] hover:bg-[#fa6e18] hover:text-white"
      }`}
      data-active={props.active ? "true" : "false"}
      href={props.href}
      onClick={props.onActivate}
    >
      <div className="tv-settings-modal__action-copy">
        <div className="tv-settings-modal__action-title">{props.label}</div>
        {props.description ? (
          <div className="tv-settings-modal__action-description">
            {props.description}
          </div>
        ) : null}
      </div>
      <div className="tv-settings-modal__action-state">
        {props.active ? "Active" : "Select"}
      </div>
    </a>
  );
}

export function TvSettingsModal(props: TvSettingsModalProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const hasRotationControls = Boolean(
    props.rotateOffHref || props.rotateMtdHref || props.rotateYtdHref,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleOpen() {
    setOpen(true);
    triggerRef.current?.closest("details")?.removeAttribute("open");
  }

  const modal = open ? (
    <div
      className="tv-settings-modal fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(15,23,42,0.24)]"
      onClick={() => setOpen(false)}
    >
      <div
        className="tv-settings-modal__panel w-full border border-[#e8ddd1] bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] shadow-[0_30px_70px_rgba(15,23,42,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tv-settings-modal__header flex items-start justify-between">
          <div>
            <div className="tv-settings-modal__title font-black tracking-tight text-[#111827]">
              TV Settings
            </div>
            <div className="tv-settings-modal__subtitle text-slate-500">
              Configure fullscreen, chrome hiding, and supported board
              rotation.
            </div>
          </div>
          <button
            className="tv-settings-modal__close inline-flex items-center justify-center rounded-full bg-[#f4f6f8] font-black text-slate-600 transition hover:bg-[#e9eef2]"
            onClick={() => setOpen(false)}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="tv-settings-modal__body">
          <div className="tv-settings-modal__sections grid">
            <section className="tv-settings-modal__section grid">
              <div className="tv-settings-modal__section-head">
                <div className="tv-settings-modal__section-title font-black uppercase tracking-[0.24em] text-slate-500">
                  Display
                </div>
                <div className="tv-settings-modal__section-copy text-slate-500">
                  Controls for fullscreen display and cleaner mounted-screen
                  playback.
                </div>
              </div>
              <div className="tv-settings-modal__actions grid">
                {props.kioskHref ? (
                  <ActionLink
                    active={Boolean(props.kioskMode)}
                    description="Hide app chrome for cleaner mounted-display playback."
                    href={props.kioskHref}
                    label={
                      props.kioskMode ? "App Chrome Hidden" : "Hide App Chrome"
                    }
                    onActivate={() => setOpen(false)}
                  />
                ) : null}
                <div className="tv-settings-modal__action-full">
                  <TvFullscreenButton />
                </div>
              </div>
            </section>

            {hasRotationControls ? (
              <section className="tv-settings-modal__section grid">
                <div className="tv-settings-modal__section-head">
                  <div className="tv-settings-modal__section-title font-black uppercase tracking-[0.24em] text-slate-500">
                    Rotation
                  </div>
                  <div className="tv-settings-modal__section-copy text-slate-500">
                    Cycle supported boards automatically using the selected date
                    scope.
                  </div>
                </div>
                <div className="tv-settings-modal__actions grid">
                  {props.rotateOffHref ? (
                    <ActionLink
                      active={props.rotateMode !== true}
                      description="Stay on the current board without automated page rotation."
                      href={props.rotateOffHref}
                      label="Rotation Off"
                      onActivate={() => setOpen(false)}
                    />
                  ) : null}
                  {props.rotateMtdHref ? (
                    <ActionLink
                      active={Boolean(
                        props.rotateMode && props.rotatePreset === "mtd",
                      )}
                      description="Rotate through supported boards with the MTD preset."
                      href={props.rotateMtdHref}
                      label="Rotate MTD"
                      onActivate={() => setOpen(false)}
                    />
                  ) : null}
                  {props.rotateYtdHref ? (
                    <ActionLink
                      active={Boolean(
                        props.rotateMode && props.rotatePreset === "ytd",
                      )}
                      description="Rotate through supported boards with the YTD preset."
                      href={props.rotateYtdHref}
                      label="Rotate YTD"
                      onActivate={() => setOpen(false)}
                    />
                  ) : null}
                </div>
                {props.rotationBoardOptions && props.rotationBoardOptions.length > 0 ? (
                  <div className="tv-settings-modal__section-head">
                    <div className="tv-settings-modal__section-title font-black uppercase tracking-[0.24em] text-slate-500">
                      Boards
                    </div>
                    <div className="tv-settings-modal__section-copy text-slate-500">
                      Select which field boards are eligible for automatic TV
                      rotation.
                    </div>
                  </div>
                ) : null}
                {props.rotationBoardOptions && props.rotationBoardOptions.length > 0 ? (
                  <div className="tv-settings-modal__actions grid">
                    {props.rotationBoardOptions.map((option) => (
                      <ActionLink
                        active={option.active}
                        href={option.href}
                        key={option.href}
                        label={option.label}
                        onActivate={() => setOpen(false)}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : (
              <section className="tv-settings-modal__section grid">
                <div className="tv-settings-modal__section-head">
                  <div className="tv-settings-modal__section-title font-black uppercase tracking-[0.24em] text-slate-500">
                    Rotation
                  </div>
                  <div className="tv-settings-modal__section-copy text-slate-500">
                    Rotation options appear on the Service, Sales, and Install
                    boards only. Open one of those boards in TV mode to choose
                    Rotate MTD or Rotate YTD.
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        className="dashboard-shell__menu-link tv-settings-modal__trigger bg-[#f7f3ee] text-left text-[#00363e] transition hover:bg-[#fa6e18] hover:text-white"
        onClick={handleOpen}
        type="button"
      >
        <div className="font-black">TV Settings</div>
      </button>
      {typeof document !== "undefined"
        ? createPortal(modal, document.body)
        : null}
    </>
  );
}
