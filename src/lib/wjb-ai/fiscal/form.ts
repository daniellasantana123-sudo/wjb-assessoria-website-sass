/**
 * Converte o formulário da tela em corpo do rascunho. Só os campos do
 * schema - nenhum campo de empresa sai daqui. Valor em formato brasileiro
 * ("1.234,56") vira "1234.56".
 */
export function nfseBodyFromForm(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const email = text("takerEmail");
  const sourceReference = text("sourceReference");
  const amount = text("grossAmount");
  return {
    serviceDescription: text("serviceDescription"),
    grossAmount: amount.includes(",")
      ? amount.replace(/\./g, "").replace(",", ".")
      : amount,
    competence: text("competence"),
    taker: {
      document: text("takerDocument"),
      name: text("takerName"),
      ...(email ? { email } : {}),
    },
    ...(sourceReference ? { sourceReference } : {}),
  };
}
