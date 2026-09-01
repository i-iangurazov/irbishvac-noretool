"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

type CampaignPeriodOption = {
  active: boolean;
  href: string;
  label: string;
};

export function CampaignPeriodSelect({ activeLabel, options }: {
  activeLabel: string;
  options: CampaignPeriodOption[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const pendingFocusRef = useRef<"active" | "first" | "last" | null>(null);

  useEffect(() => {
    if (!open) return;

    if (pendingFocusRef.current) {
      focusOption(pendingFocusRef.current);
      pendingFocusRef.current = null;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function focusOption(position: "active" | "first" | "last") {
    window.requestAnimationFrame(() => {
      const links = [...(menuRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
      const target = position === "active"
        ? links.find((link) => link.getAttribute("aria-checked") === "true") ?? links[0]
        : position === "last"
          ? links.at(-1)
          : links[0];
      target?.focus();
    });
  }

  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    pendingFocusRef.current = event.key === "ArrowUp" ? "last" : "active";
    setOpen(true);
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>) {
    const links = [...(menuRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [])];
    const currentIndex = links.indexOf(document.activeElement as HTMLAnchorElement);
    let targetIndex: number | null = null;
    if (event.key === "ArrowDown") targetIndex = (currentIndex + 1) % links.length;
    if (event.key === "ArrowUp") targetIndex = (currentIndex - 1 + links.length) % links.length;
    if (event.key === "Home") targetIndex = 0;
    if (event.key === "End") targetIndex = links.length - 1;
    if (targetIndex == null) return;
    event.preventDefault();
    links[targetIndex]?.focus();
  }

  return (
    <div className="campaign-period-select" data-open={open} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Reporting month: ${activeLabel}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={handleButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        <span>Month</span>
        <strong>{activeLabel}</strong>
      </button>
      {open ? (
        <nav
          aria-label="Available reporting months"
          className="campaign-period-select__menu"
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
          role="menu"
        >
          {options.map((option) => (
            <a
              aria-checked={option.active}
              className={option.active ? "is-active" : ""}
              href={option.href}
              key={option.href}
              onClick={() => setOpen(false)}
              role="menuitemradio"
            >
              {option.label}
            </a>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
