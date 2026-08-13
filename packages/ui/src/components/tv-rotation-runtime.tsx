"use client";

import { useEffect } from "react";

type NavItem = {
  href: string;
  label: string;
  section?: string;
  shortLabel?: string;
};

type TvRotationRuntimeProps = {
  activePath: string;
  currentPage?: number | undefined;
  enabled: boolean;
  navItems: NavItem[];
  pageCount?: number | undefined;
  presetQuery: string;
  rotateBoards?: boolean;
};

const ROTATION_INTERVAL_MS = 20_000;

export function TvRotationRuntime({
  activePath,
  currentPage = 1,
  enabled,
  navItems,
  pageCount = 1,
  presetQuery,
  rotateBoards = false
}: TvRotationRuntimeProps) {
  useEffect(() => {
    if (!enabled || navItems.length === 0) {
      return;
    }

    if (pageCount <= 1 && (!rotateBoards || navItems.length <= 1)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(presetQuery);

      if (currentPage < pageCount) {
        params.set("page", String(currentPage + 1));
        window.location.assign(`${activePath}?${params.toString()}`);
        return;
      }

      params.delete("page");

      if (!rotateBoards) {
        window.location.assign(
          params.size > 0 ? `${activePath}?${params.toString()}` : activePath,
        );
        return;
      }

      const activeIndex = navItems.findIndex((item) => item.href === activePath);
      const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % navItems.length : 0;
      const nextItem = navItems[nextIndex];

      if (!nextItem) {
        return;
      }

      window.location.assign(
        params.size > 0 ? `${nextItem.href}?${params.toString()}` : nextItem.href,
      );
    }, ROTATION_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activePath, currentPage, enabled, navItems, pageCount, presetQuery, rotateBoards]);

  return null;
}
