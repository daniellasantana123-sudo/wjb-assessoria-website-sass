// Stub pro pacote "server-only" — o Next.js dá handling especial pra ele no
// build (vira um erro se importado do lado do cliente), mas o Vitest não
// conhece esse pacote. Aliasado em vitest.config.mts só pra permitir o
// import; não faz nada em teste (que já roda só no "servidor" por natureza).
export {};
