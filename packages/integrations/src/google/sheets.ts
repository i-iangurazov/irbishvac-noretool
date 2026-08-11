import { createSign } from "node:crypto";
import { getConfig } from "@irbis/config";

type AccessToken = {
  value: string;
  expiresAt: number;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export type GoogleSheetValues = {
  range?: string;
  majorDimension?: string;
  values?: unknown[][];
};

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export class GoogleSheetsClient {
  private readonly config = getConfig().campaignPerformance.google;
  private token: AccessToken | null = null;

  getMissingConfiguration() {
    const required = [
      ["GOOGLE_CALL_CENTER_SPREADSHEET_ID", this.config.spreadsheetId],
      ["GOOGLE_SERVICE_ACCOUNT_EMAIL", this.config.serviceAccountEmail],
      ["GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", this.config.serviceAccountPrivateKey]
    ] as const;

    return required.filter(([, value]) => value.trim() === "").map(([name]) => name);
  }

  isConfigured() {
    return this.getMissingConfiguration().length === 0;
  }

  private async getAccessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return this.token.value;
    }

    const missing = this.getMissingConfiguration();
    if (missing.length > 0) {
      throw new Error(`Google Sheets integration is not configured: ${missing.join(", ")}`);
    }

    const now = Math.floor(Date.now() / 1_000);
    const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = encodeBase64Url(
      JSON.stringify({
        iss: this.config.serviceAccountEmail,
        scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3_600
      }),
    );
    const unsignedToken = `${header}.${claims}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsignedToken);
    signer.end();
    const privateKey = this.config.serviceAccountPrivateKey.replace(/\\n/g, "\n");
    const assertion = `${unsignedToken}.${encodeBase64Url(signer.sign(privateKey))}`;

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    });
    const payload = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || !payload.access_token) {
      const detail = payload.error_description ?? payload.error ?? `HTTP ${response.status}`;
      throw new Error(`Google service-account authentication failed: ${detail}`);
    }

    this.token = {
      value: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3_600) * 1_000
    };
    return this.token.value;
  }

  async getValues(range: string): Promise<GoogleSheetValues> {
    const accessToken = await this.getAccessToken();
    const spreadsheetId = encodeURIComponent(this.config.spreadsheetId);
    const encodedRange = encodeURIComponent(range);
    const url = new URL(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
    );
    url.searchParams.set("majorDimension", "ROWS");
    url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
    url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Google Sheets read failed (${response.status}): ${body.slice(0, 500)}`);
    }

    return (await response.json()) as GoogleSheetValues;
  }

  async getOptionalValues(range: string): Promise<GoogleSheetValues | null> {
    try {
      return await this.getValues(range);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Google Sheets read failed (400)")) {
        return null;
      }
      throw error;
    }
  }
}
