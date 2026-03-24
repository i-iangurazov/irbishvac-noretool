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
};

function ActionLink(props: {
  href: string;
  label: string;
  active?: boolean;
  onActivate?: (() => void) | undefined;
}) {
  return (
    <a
      className={`tv-settings-modal__action flex min-h-[3rem] items-center rounded-[0.95rem] px-3 py-2.5 text-sm font-black transition 3xl:min-h-[3.25rem] 3xl:px-4 3xl:py-3 3xl:text-[1rem] 5xl:min-h-[3.5rem] 5xl:px-5 5xl:py-3.5 5xl:text-[1.08rem] ${
        props.active
          ? "bg-[#0b4d5a] text-white shadow-[0_10px_22px_rgba(11,77,90,0.16)]"
          : "bg-[#f7f3ee] text-[#00363e] hover:bg-[#fa6e18] hover:text-white"
      }`}
      href={props.href}
      onClick={props.onActivate}
    >
      {props.label}
    </a>
  );
}

export function TvSettingsModal(props: TvSettingsModalProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

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
      className="tv-settings-modal fixed inset-0 z-[100] flex items-start justify-end bg-[rgba(15,23,42,0.18)] p-4 pt-20 3xl:p-5 3xl:pt-24 5xl:p-6 5xl:pt-28"
      onClick={() => setOpen(false)}
    >
      <div
        className="tv-settings-modal__panel w-full max-w-[28rem] rounded-[1.3rem] border border-[#e8ddd1] bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] p-5 shadow-[0_30px_70px_rgba(15,23,42,0.2)] 3xl:max-w-[31rem] 3xl:p-6 5xl:max-w-[34rem] 5xl:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="tv-settings-modal__title text-[1.05rem] font-black tracking-tight text-[#111827] 3xl:text-[1.18rem] 5xl:text-[1.34rem]">
              TV Settings
            </div>
            <div className="tv-settings-modal__subtitle mt-1 text-sm text-slate-500 3xl:text-[0.96rem] 5xl:text-[1.04rem]">
              Configure TV mode, fullscreen, chrome hiding, and page rotation.
            </div>
          </div>
          <button
            className="tv-settings-modal__close inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f6f8] text-lg font-black text-slate-600 transition hover:bg-[#e9eef2] 3xl:h-10 3xl:w-10 5xl:h-11 5xl:w-11"
            onClick={() => setOpen(false)}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-5 3xl:mt-6 3xl:gap-6">
          <section className="grid gap-2.5">
            <div className="tv-settings-modal__section-title text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 3xl:text-[12px] 5xl:text-[13px]">
              Display
            </div>
            <div className="tv-settings-modal__actions grid gap-2.5 sm:grid-cols-2">
              <ActionLink
                active={Boolean(props.enabled)}
                href={props.toggleHref}
                label={props.enabled ? "TV Mode On" : "TV Mode Off"}
                onActivate={() => setOpen(false)}
              />
              {props.kioskHref ? (
                <ActionLink
                  active={Boolean(props.kioskMode)}
                  href={props.kioskHref}
                  label={props.kioskMode ? "App Chrome Hidden" : "Hide App Chrome"}
                  onActivate={() => setOpen(false)}
                />
              ) : null}
              <div className="sm:col-span-2">
                <TvFullscreenButton />
              </div>
            </div>
          </section>

          <section className="grid gap-2.5">
            <div className="tv-settings-modal__section-title text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 3xl:text-[12px] 5xl:text-[13px]">
              Rotation
            </div>
            <div className="tv-settings-modal__actions grid gap-2.5 sm:grid-cols-3">
              {props.rotateOffHref ? (
                <ActionLink
                  active={props.rotateMode !== true}
                  href={props.rotateOffHref}
                  label="Rotation Off"
                  onActivate={() => setOpen(false)}
                />
              ) : null}
              {props.rotateMtdHref ? (
                <ActionLink
                  active={Boolean(props.rotateMode && props.rotatePreset === "mtd")}
                  href={props.rotateMtdHref}
                  label="Rotate MTD"
                  onActivate={() => setOpen(false)}
                />
              ) : null}
              {props.rotateYtdHref ? (
                <ActionLink
                  active={Boolean(props.rotateMode && props.rotatePreset === "ytd")}
                  href={props.rotateYtdHref}
                  label="Rotate YTD"
                  onActivate={() => setOpen(false)}
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        className="dashboard-shell__menu-link rounded-xl bg-[#f7f3ee] px-3 py-2.5 text-left text-sm text-[#00363e] transition hover:bg-[#fa6e18] hover:text-white 3xl:px-4 3xl:py-3.5 3xl:text-[1rem] 4xl:text-[1.08rem] 5xl:px-4.5 5xl:py-4 5xl:text-[1.16rem]"
        onClick={handleOpen}
        type="button"
      >
        <div className="font-black">TV Settings</div>
      </button>
      {typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </>
  );
}
