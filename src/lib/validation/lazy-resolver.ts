/**
 * Validação de formulário carregada sob demanda (2026-10-02).
 *
 * O zod (~35 KB) ia junto com TODAS as páginas só por causa do campo de
 * newsletter do rodapé, embora a validação só rode quando alguém envia. Com
 * isto, o zod e o schema são baixados na primeira validação (alguns
 * milissegundos) e reaproveitados depois. O formulário funciona igual.
 *
 * Uso: `resolver: lazyResolver(() => import(...).then(... zodResolver(schema)))`.
 */
export function lazyResolver<F extends (...args: never[]) => unknown>(load: () => Promise<F>): F {
  let resolver: Promise<F> | undefined;
  const lazy = async (...args: Parameters<F>) => {
    resolver ??= load();
    const fn = (await resolver) as unknown as (...a: Parameters<F>) => ReturnType<F>;
    return fn(...args);
  };
  // Mesma assinatura do resolver real; só passa a ser sempre assíncrono, o
  // que o react-hook-form aceita.
  return lazy as unknown as F;
}
