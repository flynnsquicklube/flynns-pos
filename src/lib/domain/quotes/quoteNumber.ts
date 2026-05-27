import { query } from "../../db/sqlite";

export async function generateQuoteNumber(date = new Date()): Promise<string> {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const [row] = await query<{ count: number }>("SELECT COUNT(*) AS count FROM quotes WHERE quote_number LIKE ?", [`Q-${datePart}-%`]);
  return `Q-${datePart}-${String((row?.count ?? 0) + 1).padStart(4, "0")}`;
}
