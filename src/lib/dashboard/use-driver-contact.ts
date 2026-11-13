"use client";

import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { fetchMissionDriverContact } from "./service";
import type { DriverContact } from "./types";

type DriverContactState = {
  contact: DriverContact | null;
  loading: boolean;
};

type LoadedContact = {
  key: string;
  contact: DriverContact | null;
};

const IDLE: DriverContactState = { contact: null, loading: false };

/**
 * Fetches the assigned driver's contact for one selected mission. The request
 * key is `missionId:driverId`, so a reassignment or a released driver drops the
 * previous contact immediately and triggers a fresh read. No request is made
 * while the mission has no driver, which keeps the queue free of per-row calls.
 */
export function useDriverContact(
  missionId: string | null,
  driverId: string | null,
): DriverContactState {
  const key = missionId && driverId ? `${missionId}:${driverId}` : null;
  const [loaded, setLoaded] = useState<LoadedContact | null>(null);

  useEffect(() => {
    if (!key || !missionId || !driverId) return;

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      // Async so the effect never sets state synchronously.
      void Promise.resolve().then(() => {
        if (!cancelled) setLoaded({ key, contact: null });
      });
      return () => {
        cancelled = true;
      };
    }

    void fetchMissionDriverContact(supabase, missionId).then((result) => {
      if (cancelled) return;
      // A payload for a driver the mission no longer has is stale.
      const current = result.ok && result.data.driver_id === driverId ? result.data : null;
      setLoaded({ key, contact: current });
    });

    return () => {
      cancelled = true;
    };
  }, [key, missionId, driverId]);

  if (!key) return IDLE;
  if (loaded?.key !== key) return { contact: null, loading: true };
  return { contact: loaded.contact, loading: false };
}
