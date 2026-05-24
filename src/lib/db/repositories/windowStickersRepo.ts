import { execute, query } from "../sqlite";
import { createId } from "../../utils/ids";
import { nowIso } from "../../utils/dates";

export type WindowStickerStatus = "queued" | "previewed" | "printed" | "canceled";

export interface WindowSticker {
  id: string;
  ticket_id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  sticker_type: string;
  status: WindowStickerStatus;
  print_data_json: string;
  created_at: string;
  updated_at: string;
  printed_at: string | null;
  deleted_at: string | null;
  sync_status: string;
}

export interface CreateWindowStickerInput {
  ticket_id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  print_data_json: string;
}

export async function createWindowSticker(input: CreateWindowStickerInput): Promise<WindowSticker> {
  const id = createId("sticker");
  const timestamp = nowIso();
  await execute(
    `INSERT INTO window_stickers (
      id, ticket_id, customer_id, vehicle_id, sticker_type, status, print_data_json,
      created_at, updated_at, printed_at, deleted_at, sync_status
    ) VALUES (?, ?, ?, ?, 'oil_change', 'queued', ?, ?, ?, NULL, NULL, 'pending')`,
    [id, input.ticket_id, input.customer_id, input.vehicle_id, input.print_data_json, timestamp, timestamp]
  );
  const sticker = await getWindowSticker(id);
  if (!sticker) throw new Error("Window sticker was not created.");
  return sticker;
}

export async function getWindowSticker(id: string): Promise<WindowSticker | null> {
  const rows = await query<WindowSticker>("SELECT * FROM window_stickers WHERE id = ? AND deleted_at IS NULL", [id]);
  return rows[0] ?? null;
}

export async function getLatestWindowStickerForTicket(ticketId: string): Promise<WindowSticker | null> {
  const rows = await query<WindowSticker>(
    "SELECT * FROM window_stickers WHERE ticket_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1",
    [ticketId]
  );
  return rows[0] ?? null;
}

export async function updateWindowStickerStatus(id: string, status: WindowStickerStatus): Promise<void> {
  await execute(
    "UPDATE window_stickers SET status = ?, printed_at = CASE WHEN ? = 'printed' THEN ? ELSE printed_at END, updated_at = ?, sync_status = 'pending' WHERE id = ?",
    [status, status, nowIso(), nowIso(), id]
  );
}
