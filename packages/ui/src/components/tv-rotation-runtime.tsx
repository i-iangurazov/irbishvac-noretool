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
  enabled: boolean;
  navItems: NavItem[];
  presetQuery: string;
};

const ROTATION_INTERVAL_MS = 20_000;

export function TvRotationRuntime({
  activePath,
  enabled,
  navItems,
  presetQuery
}: TvRotationRuntimeProps) {
  useEffect(() => {
    if (!enabled || navItems.length < 2) {
      return;
    }

    const availableItems = navItems.filter((item) => item.href !== activePath);

    if (availableItems.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const nextItem =
        availableItems[Math.floor(Math.random() * availableItems.length)] ?? availableItems[0];

      if (!nextItem) {
        return;
      }

      window.location.assign(presetQuery ? `${nextItem.href}?${presetQuery}` : nextItem.href);
    }, ROTATION_INTERVAL_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activePath, enabled, navItems, presetQuery]);

  return null;
}
