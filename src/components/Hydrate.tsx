"use client";
import { useEffect, useState } from "react";
import { useStudio } from "@/lib/store";

/** Loads the saved studio (projects, canvas, vault, registry) from this device after the page mounts. */
export default function Hydrate() {
  useEffect(() => {
    useStudio.persist.rehydrate();
  }, []);
  return null;
}

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    const unsub = useStudio.persist.onFinishHydration(() => setH(true));
    if (useStudio.persist.hasHydrated()) setH(true);
    return unsub;
  }, []);
  return h;
}
