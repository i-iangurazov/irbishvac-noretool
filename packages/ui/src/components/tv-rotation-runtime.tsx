"use client";

import { useRouter } from "next/navigation";
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

const ROTATION_INTERVAL_MS = 10_000;

export function TvRotationRuntime({
  activePath,
  currentPage = 1,
  enabled,
  navItems,
  pageCount = 1,
  presetQuery,
  rotateBoards = false
}: TvRotationRuntimeProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || navItems.length === 0) {
      return;
    }

    if (pageCount <= 1 && (!rotateBoards || navItems.length <= 1)) {
      return;
    }

    const navigate = (href: string) => {
      router.replace(href as Parameters<typeof router.replace>[0], {
        scroll: false,
      });
    };

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(presetQuery);

      if (currentPage < pageCount) {
        params.set("page", String(currentPage + 1));
        navigate(`${activePath}?${params.toString()}`);
        return;
      }

      params.delete("page");

      if (!rotateBoards) {
        navigate(
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

      navigate(
        params.size > 0 ? `${nextItem.href}?${params.toString()}` : nextItem.href,
      );
    }, ROTATION_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activePath, currentPage, enabled, navItems, pageCount, presetQuery, rotateBoards, router]);

  return null;
}
