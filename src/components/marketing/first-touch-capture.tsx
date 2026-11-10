"use client";

import { useEffect } from "react";

import { captureFirstTouch } from "@/lib/analytics/tracking";

/** Guarda a origem da campanha na primeira página da visita (ver `tracking.ts`). */
export function FirstTouchCapture() {
  useEffect(() => {
    captureFirstTouch();
  }, []);
  return null;
}
