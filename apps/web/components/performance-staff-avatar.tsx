"use client";

import { useMemo, useState } from "react";

function initialsFor(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : parts[0]?.[1] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function PerformanceStaffAvatar(props: {
  name: string;
  imageUrl: string | null;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const initials = useMemo(() => initialsFor(props.name), [props.name]);

  return (
    <div
      className={`performance-avatar ${props.large ? "performance-avatar--large" : ""}`}
      aria-label={props.name}
    >
      <span aria-hidden="true">{initials}</span>
      {props.imageUrl && !failed ? (
        <img
          alt=""
          src={props.imageUrl}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
