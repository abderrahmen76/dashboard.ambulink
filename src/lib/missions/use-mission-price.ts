"use client";

import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { fetchMissionPrice } from "./service";

type MissionPriceState = {
  price: number | null;
  loading: boolean;
};

type LoadedPrice = {
  key: string;
  price: number | null;
};

const IDLE: MissionPriceState = { price: null, loading: false };

/**
 * Price of one selected mission. The RPC decides eligibility from stored
 * facts, so the client only renders a non-null amount. An UPDATE on the
 * mission (assignment, completion, saved financials) re-runs the same RPC, so
 * the amount follows the current assigned driver instead of the row that
 * happened to be displayed when the modal opened.
 */
export function useMissionPrice(missionId: string | null): MissionPriceState {
  const key = missionId;
  const [loaded, setLoaded] = useState<LoadedPrice | null>(null);

  useEffect(() => {
    if (!missionId) return;

    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      // Async so the effect never sets state synchronously.
      void Promise.resolve().then(() => {
        if (!cancelled) setLoaded({ key: missionId, price: null });
      });
      return () => {
        cancelled = true;
      };
    }

    const load = () => {
      void fetchMissionPrice(supabase, missionId).then((result) => {
        if (cancelled) return;
        setLoaded({ key: missionId, price: result.ok ? result.data.price : null });
      });
    };

    load();

    const channel = supabase
      .channel(`mission-price-${missionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "missions",
          filter: `id=eq.${missionId}`,
        },
        load,
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [missionId]);

  if (!key) return IDLE;
  if (loaded?.key !== key) return { price: null, loading: true };
  return { price: loaded.price, loading: false };
}
