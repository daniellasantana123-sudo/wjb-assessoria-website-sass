# Acessibilidade

> Status: **FASE 0**. Meta mínima definida na seção 9 de [`../../Wjb-Website.md`](../../Wjb-Website.md): **WCAG 2.2 AA**.

## Implementar

- HTML semântico;
- landmarks;
- skip link;
- navegação por teclado;
- foco visível;
- contraste adequado;
- ARIA somente quando necessário;
- labels completos;
- alt text;
- mensagens de erro acessíveis;
- suporte a zoom 200%;
- `prefers-reduced-motion`;
- targets de toque com no mínimo 44 × 44 px.

## Responsividade (seção 10)

Mobile first. Testar em: 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920px. Nenhuma página pode ter scroll horizontal causado pelo layout.

## Pendências desta fase

- [ ] Validar cada critério com testes automatizados (axe, Lighthouse) a partir da FASE 6.
- [ ] Checklist de teclado e leitor de tela antes do lançamento (FASE 7).
