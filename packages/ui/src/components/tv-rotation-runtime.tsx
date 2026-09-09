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
  intervalMs?: number | undefined;
  navItems: NavItem[];
  pageCount?: number | undefined;
  presetQuery: string;
  rotateBoards?: boolean;
  minViewportWidth?: number | undefined;
};

const DEFAULT_ROTATION_INTERVAL_MS = 10_000;

export function TvRotationRuntime({
  activePath,
  currentPage = 1,
  enabled,
  intervalMs = DEFAULT_ROTATION_INTERVAL_MS,
  navItems,
  pageCount = 1,
  presetQuery,
  rotateBoards = false,
  minViewportWidth = 0,
}: TvRotationRuntimeProps) {
  const router = useRouter();
  // Server refreshes recreate nav objects; only a route change should reset the timer.
  const routeKey = JSON.stringify(navItems.map((item) => item.href));

  useEffect(() => {
    const routes = JSON.parse(routeKey) as string[];
    if (!enabled || routes.length === 0) {
      return;
    }

    if (pageCount <= 1 && (!rotateBoards || routes.length <= 1)) {
      return;
    }

    const navigate = (href: string) => {
      router.replace(href as Parameters<typeof router.replace>[0], {
        scroll: false,
      });
    };

    const query = window.matchMedia(`(min-width: ${minViewportWidth}px)`);
    let timeout: number | undefined;
    const schedule = () => {
      window.clearTimeout(timeout);
      if (!query.matches) return;
      timeout = window.setTimeout(() => {
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

        const activeIndex = routes.indexOf(activePath);
        const nextIndex =
          activeIndex >= 0 ? (activeIndex + 1) % routes.length : 0;
        const nextItem = routes[nextIndex];

        if (!nextItem) {
          return;
        }

        navigate(
          params.size > 0 ? `${nextItem}?${params.toString()}` : nextItem,
        );
      }, intervalMs);
    };
    schedule();
    query.addEventListener("change", schedule);

    return () => {
      window.clearTimeout(timeout);
      query.removeEventListener("change", schedule);
    };
  }, [
    activePath,
    currentPage,
    enabled,
    intervalMs,
    routeKey,
    pageCount,
    presetQuery,
    rotateBoards,
    router,
    minViewportWidth,
  ]);

  return null;
}
