"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/** Keep financial details visible outside clipped cards and scrolling tables. */
export function MarketingTooltip({
  content,
  children,
  as: Tag = "span",
  className,
  tabIndex = 0,
  ...props
}: HTMLAttributes<HTMLElement> & {
  content: string;
  as?: "strong" | "small" | "span" | "td" | "div";
  children: ReactNode;
}) {
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  const close = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (document.activeElement !== anchor) setAnchor(null);
    }, 120);
  };

  useLayoutEffect(() => {
    if (!anchor) return;
    const place = () => {
      if (!popup.current) return;
      const rect = anchor.getBoundingClientRect();
      const { width, height } = popup.current.getBoundingClientRect();
      const below = rect.bottom + 8;
      setPosition({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: Math.max(
          12,
          Math.min(
            below + height <= window.innerHeight - 12
              ? below
              : rect.top - height - 8,
            window.innerHeight - height - 12,
          ),
        ),
      });
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAnchor(null);
    };
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !anchor.contains(event.target) &&
        !popup.current?.contains(event.target)
      )
        setAnchor(null);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("keydown", dismiss);
    document.addEventListener("pointerdown", outside);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("pointerdown", outside);
    };
  }, [anchor, content]);

  return (
    <>
      <Tag
        {...props}
        className={[className, "marketing-tooltip-trigger"]
          .filter(Boolean)
          .join(" ")}
        tabIndex={tabIndex}
        aria-describedby={
          anchor
            ? [props["aria-describedby"], id].filter(Boolean).join(" ")
            : props["aria-describedby"]
        }
        onMouseEnter={(event) => {
          props.onMouseEnter?.(event);
          cancelClose();
          setAnchor(event.currentTarget);
        }}
        onMouseLeave={(event) => {
          props.onMouseLeave?.(event);
          close();
        }}
        onFocus={(event) => {
          props.onFocus?.(event);
          cancelClose();
          setAnchor(event.currentTarget);
        }}
        onBlur={(event) => {
          props.onBlur?.(event);
          cancelClose();
          setAnchor(null);
        }}
        onClick={(event) => {
          props.onClick?.(event);
          cancelClose();
          setAnchor(event.currentTarget);
        }}
      >
        {children}
      </Tag>
      {anchor
        ? createPortal(
            <div
              className="marketing-tooltip"
              id={id}
              role="tooltip"
              ref={popup}
              style={position}
              onMouseEnter={cancelClose}
              onMouseLeave={close}
            >
              {content.split("\n").map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
