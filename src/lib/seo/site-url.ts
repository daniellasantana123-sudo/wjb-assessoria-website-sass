/** URL pública do site — ver .env.example. Fallback local para dev/build sem env definida. */
export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
