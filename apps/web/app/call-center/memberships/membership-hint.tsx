"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

export function membershipTooltipPosition(
  anchor: Pick<DOMRect, "left" | "right" | "top" | "bottom">,
  popup: { width: number; height: number },
  viewport: { width: number; height: number },
) {
  const margin = 12,
    gap = 8;
  const above = anchor.top - gap - popup.height;
  return {
    left: Math.max(
      margin,
      Math.min(
        (anchor.left + anchor.right - popup.width) / 2,
        viewport.width - popup.width - margin,
      ),
    ),
    top: Math.max(
      margin,
      Math.min(
        above >= margin ? above : anchor.bottom + gap,
        viewport.height - popup.height - margin,
      ),
    ),
  };
}

/** Render outside clipped cards/tables and reposition against the actual viewport. */
export function MembershipHint({
  children,
  label,
}: {
  children: string;
  label?: string;
}) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const retain = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const dismiss = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  useLayoutEffect(() => () => clearTimeout(closeTimer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (!anchor.current || !popup.current) return;
      const next = membershipTooltipPosition(
        anchor.current.getBoundingClientRect(),
        popup.current.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
      );
      setPosition((previous) =>
        previous.left === next.left && previous.top === next.top
          ? previous
          : next,
      );
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearTimeout(closeTimer.current);
        setOpen(false);
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        !anchor.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (anchor.current) observer?.observe(anchor.current);
    if (popup.current) observer?.observe(popup.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", outside);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="csr-hint membership-hint-trigger"
        aria-label={label ? `About ${label}` : "Metric information"}
        aria-describedby={open ? id : undefined}
        onMouseEnter={retain}
        onMouseLeave={dismiss}
        onFocus={retain}
        onBlur={dismiss}
        onClick={(event) => {
          event.stopPropagation();
          retain();
        }}
      >
        <CircleHelp size={14} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="tooltip"
            className="membership-tooltip"
            style={position}
            onMouseEnter={retain}
            onMouseLeave={dismiss}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
