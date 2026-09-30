import { manualResponse, readManual } from "@/lib/manual";

/**
 * Guia do Portal do Cliente - aberto de propósito, para a WJB mandar o link
 * a clientes que ainda nem criaram a senha. Não traz nada interno (Admin,
 * permissões da equipe, G-Click); fica fora do Google por `X-Robots-Tag`.
 */
export function GET() {
  return manualResponse(readManual("guia-cliente.html"), "public, max-age=300");
}
