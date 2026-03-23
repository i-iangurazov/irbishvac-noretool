import { Pool } from "pg";
import { getConfig } from "@irbis/config";

export type RetoolSnapshotRow = {
  snapshotTime: Date;
  payload: unknown;
};

export type RetoolGoalRow = {
  monthIndex: number;
  monthName: string;
  goalAmount: number;
  updatedAt: Date;
};

function parsePayload(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class RetoolDbClient {
  private readonly url = getConfig().retoolDatabase.url;

  private readonly connectionString = this.url
    ? this.url.replace(/([?&])sslmode=require\b/, "$1")
    : null;

  private readonly pool = this.url
    ? new Pool({
        connectionString: this.connectionString ?? this.url,
        connectionTimeoutMillis: 5_000,
        ssl: this.url.includes("sslmode=require")
          ? {
              rejectUnauthorized: false
            }
          : undefined
      })
    : null;

  isConfigured() {
    return Boolean(this.pool);
  }

  async close() {
    await this.pool?.end();
  }

  async fetchLatestSnapshot(tableName: string): Promise<RetoolSnapshotRow | null> {
    if (!this.pool) {
      return null;
    }

    const query = `
      SELECT snapshot_time, raw_json
      FROM ${tableName}
      ORDER BY snapshot_time DESC
      LIMIT 1
    `;

    const result = await this.pool.query<{ snapshot_time: Date; raw_json: unknown }>(query);
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      snapshotTime: row.snapshot_time,
      payload: parsePayload(row.raw_json)
    };
  }

  async fetchGoalTrackerRows(): Promise<RetoolGoalRow[]> {
    if (!this.pool) {
      return [];
    }

    const result = await this.pool.query<{
      month_index: number;
      month_name: string;
      goal_amount: number;
      updated_at: Date;
    }>(
      `
        SELECT month_index, month_name, goal_amount, updated_at
        FROM st_goal_tracker
        ORDER BY month_index
      `,
    );

    return result.rows.map((row: {
      month_index: number;
      month_name: string;
      goal_amount: number;
      updated_at: Date;
    }) => ({
      monthIndex: row.month_index,
      monthName: row.month_name,
      goalAmount: Number(row.goal_amount),
      updatedAt: row.updated_at
    }));
  }
}
