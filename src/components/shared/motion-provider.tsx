"use client";

import type { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "framer-motion";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

/**
 * Animações do header e dos menus (framer-motion).
 *
 * `LazyMotion` (2026-10-02, PageSpeed apontou ~40 KB de JS não usado no
 * carregamento): os componentes usam `m.div` em vez de `motion.div`, e o
 * motor de animação só é baixado depois, em segundo plano - antes ia
 * inteiro junto com a página. As animações são as mesmas.
 *
 * `reducedMotion="user"` (2026-09-19): a regra global de
 * `prefers-reduced-motion` em globals.css não alcança animações feitas por
 * JS, então o framer-motion precisa desse opt-in próprio.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={loadFeatures}>{children}</LazyMotion>
    </MotionConfig>
  );
}
