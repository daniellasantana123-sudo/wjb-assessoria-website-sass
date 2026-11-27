import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * `false` no HTML do servidor e até a hidratação terminar; `true` depois.
 *
 * Fase 10E: formulários que só enviam por `onSubmit` (fetch) não podem
 * aceitar clique antes da hidratação. Sem o JavaScript pronto, o navegador
 * faz o envio NATIVO (GET para a mesma página), o que recarrega a tela e
 * coloca nome, e-mail e telefone na URL. Visto na CI como instabilidade no
 * WebKit (mais lento), mas é o mesmo risco num celular devagar.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
