import { query } from "../../db/sqlite";

export async function generateOrderDraftNumber(date = new Date()): Promise<string> {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, "");
  const [row] = await query<{ count: number }>("SELECT COUNT(*) AS count FROM order_drafts WHERE draft_number LIKE ?", [`DRAFT-${datePart}-%`]);
  return `DRAFT-${datePart}-${String((row?.count ?? 0) + 1).padStart(4, "0")}`;
}
