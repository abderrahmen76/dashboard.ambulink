"use client";

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import {
  archiveHospitalAmbulance,
  assignHospitalAmbulanceDriver,
  fetchFleetSnapshot,
  saveHospitalAmbulance,
} from "./service";
import type {
  FleetArchiveResult,
  FleetAssignResult,
  FleetErrorCode,
  FleetResult,
  FleetSaveResult,
  FleetSnapshot,
  SaveAmbulanceInput,
} from "./types";

export type FleetConnectionState = "connecting" | "live" | "reconnecting" | "offline";

type DriverRow = {
  id?: string;
  availability?: boolean | null;
  current_lat?: number | null;
  current_lng?: number | null;
  location_updated_at?: string | null;
};

const SNAPSHOT_DEBOUNCE_MS = 400;
const DRIVER_PATCH_MS = 900;
const FALLBACK_POLL_MS = 20_000;

/**
 * One Realtime socket, one channel per table, one debounced snapshot refetch.
 * Driver GPS/availability is patched in place so frequent location writes never
 * trigger a full refetch; vehicle, mission and driver lifecycle changes do,
 * because assignment names and derived statuses come from the server.
 */
export function useFleet(initial: FleetResult<FleetSnapshot>) {
  const [snapshot, setSnapshot] = useState<FleetSnapshot | null>(
    initial.ok ? initial.data : null,
  );
  const [error, setError] = useState<FleetErrorCode | null>(
    initial.ok ? null : initial.code,
  );
  const [connection, setConnection] = useState<FleetConnectionState>("connecting");
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(
    initial.ok ? Date.parse(initial.data.server_now) : null,
  );

  const clientRef = useRef<SupabaseClient | null>(null);
  const snapshotRef = useRef<FleetSnapshot | null>(initial.ok ? initial.data : null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driverPatchesRef = useRef(new Map<string, DriverRow>());

  const hospitalId = snapshot?.hospital.id ?? null;

  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = createSupabaseBrowserClient();
    return clientRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const supabase = getClient();
    if (!supabase) {
      setError("unexpected");
      setConnection("offline");
      return;
    }
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      let runAgain = true;
      while (runAgain) {
        runAgain = false;
        queuedRef.current = false;
        const result = await fetchFleetSnapshot(supabase);
        if (!mountedRef.current) return;
        if (result.ok) {
          snapshotRef.current = result.data;
          setSnapshot(result.data);
          setUpdatedAt(Date.parse(result.data.server_now));
          setError(null);
        } else {
          setError(result.code === "network" ? "stale" : result.code);
          // Without a snapshot there is no hospital id, so no realtime channel
          // can exist; report the connection honestly instead of "connecting".
          if (!snapshotRef.current) {
            setConnection(result.code === "network" ? "reconnecting" : "offline");
          }
        }
        if (queuedRef.current) runAgain = true;
      }
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setRefreshing(false);
    }
  }, [getClient]);

  const scheduleRefresh = useCallback(
    (delay = SNAPSHOT_DEBOUNCE_MS) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void refresh();
      }, delay);
    },
    [refresh],
  );

  const applySnapshot = useCallback((next: FleetSnapshot) => {
    if (!mountedRef.current) return;
    snapshotRef.current = next;
    setSnapshot(next);
    setUpdatedAt(Date.parse(next.server_now));
    setError(null);
  }, []);

  const saveAmbulance = useCallback(
    async (input: SaveAmbulanceInput): Promise<FleetSaveResult> => {
      const supabase = getClient();
      if (!supabase) return { ok: false, code: "unexpected" };
      const result = await saveHospitalAmbulance(supabase, input);
      if (!result.ok) {
        if (result.code === "migration_pending" || result.code === "access_denied") {
          setError(result.code);
        }
        return result;
      }
      applySnapshot(result.snapshot);
      return result;
    },
    [applySnapshot, getClient],
  );

  const assignDriver = useCallback(
    async (
      ambulanceId: string,
      driverId: string | null,
      confirmReplace: boolean,
    ): Promise<FleetAssignResult> => {
      const supabase = getClient();
      if (!supabase) return { ok: false, code: "unexpected" };
      const result = await assignHospitalAmbulanceDriver(
        supabase,
        ambulanceId,
        driverId,
        confirmReplace,
      );
      if (!result.ok) {
        if (result.code === "migration_pending" || result.code === "access_denied") {
          setError(result.code);
        }
        return result;
      }
      applySnapshot(result.snapshot);
      return result;
    },
    [applySnapshot, getClient],
  );

  const archiveAmbulance = useCallback(
    async (ambulanceId: string): Promise<FleetArchiveResult> => {
      const supabase = getClient();
      if (!supabase) return { ok: false, code: "unexpected" };
      const result = await archiveHospitalAmbulance(supabase, ambulanceId);
      if (!result.ok) {
        if (result.code === "migration_pending" || result.code === "access_denied") {
          setError(result.code);
        }
        return result;
      }
      applySnapshot(result.snapshot);
      return result;
    },
    [applySnapshot, getClient],
  );

  const flushDriverPatches = useCallback(() => {
    driverTimerRef.current = null;
    const patches = driverPatchesRef.current;
    if (!patches.size) return;
    const batch = new Map(patches);
    patches.clear();
    setSnapshot((current) => {
      if (!current) return current;
      return {
        ...current,
        drivers: current.drivers.map((driver) => {
          const patch = batch.get(driver.id);
          return patch ? { ...driver, ...patch } : driver;
        }),
        ambulances: current.ambulances.map((ambulance) => {
          if (!ambulance.driver_id) return ambulance;
          const patch = batch.get(ambulance.driver_id);
          if (!patch) return ambulance;
          return {
            ...ambulance,
            driver_availability:
              patch.availability !== undefined
                ? patch.availability
                : ambulance.driver_availability,
            driver_lat:
              patch.current_lat !== undefined ? patch.current_lat : ambulance.driver_lat,
            driver_lng:
              patch.current_lng !== undefined ? patch.current_lng : ambulance.driver_lng,
            location_updated_at:
              patch.location_updated_at !== undefined
                ? patch.location_updated_at
                : ambulance.location_updated_at,
          };
        }),
      };
    });
  }, []);

  const queueDriverPatch = useCallback(
    (row: DriverRow) => {
      if (!row.id) return;
      driverPatchesRef.current.set(row.id, {
        id: row.id,
        availability: row.availability,
        current_lat: row.current_lat,
        current_lng: row.current_lng,
        location_updated_at: row.location_updated_at,
      });
      if (!driverTimerRef.current) {
        driverTimerRef.current = setTimeout(flushDriverPatches, DRIVER_PATCH_MS);
      }
    },
    [flushDriverPatches],
  );

  // A failed initial snapshot (network, or the pending migration) has no
  // hospital id yet, so subscriptions cannot start; retrying is the only path.
  useEffect(() => {
    mountedRef.current = true;
    if (!initial.ok) void refresh();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hospitalId) return;
    const supabase = getClient();
    if (!supabase) return;

    let pollTimer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => void refresh(), FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const handleStatus = (status: string) => {
      if (!mountedRef.current) return;
      if (status === "SUBSCRIBED") {
        setConnection("live");
        stopPolling();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConnection("reconnecting");
        startPolling();
      } else if (status === "CLOSED") {
        setConnection("offline");
        startPolling();
      }
    };

    const channels: RealtimeChannel[] = [
      supabase
        .channel(`fleet-missions-${hospitalId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "missions",
            filter: `target_hospital_id=eq.${hospitalId}`,
          },
          () => scheduleRefresh(),
        )
        .subscribe(handleStatus),
      supabase
        .channel(`fleet-drivers-${hospitalId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "drivers",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          (payload: RealtimePostgresChangesPayload<DriverRow>) => {
            queueDriverPatch(payload.new as DriverRow);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "drivers",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          () => scheduleRefresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "drivers",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          () => scheduleRefresh(),
        )
        .subscribe(handleStatus),
      supabase
        .channel(`fleet-ambulances-${hospitalId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ambulances",
            filter: `hospital_id=eq.${hospitalId}`,
          },
          () => scheduleRefresh(),
        )
        .subscribe(handleStatus),
    ];

    const handleOnline = () => {
      setConnection("reconnecting");
      void refresh();
    };
    const handleOffline = () => setConnection("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      stopPolling();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (driverTimerRef.current) {
        clearTimeout(driverTimerRef.current);
        driverTimerRef.current = null;
      }
      for (const channel of channels) void supabase.removeChannel(channel);
    };
  }, [hospitalId, getClient, refresh, scheduleRefresh, queueDriverPatch]);

  return {
    snapshot,
    error,
    connection,
    refreshing,
    updatedAt,
    refresh,
    saveAmbulance,
    assignDriver,
    archiveAmbulance,
  };
}
