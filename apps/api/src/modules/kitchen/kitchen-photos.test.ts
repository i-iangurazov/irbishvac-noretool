import { describe, expect, it, vi } from "vitest";
import { normalizeKitchenDirectory } from "@irbis/domain";
import {
  kitchenPhotoCandidates,
  preferKitchenCloudflarePhotos,
} from "./kitchen-photos";

const assets = {
  publicBaseUrl: "https://photos.example.com",
  technicianPhotoFolder: "technicians_photos",
  technicianPhotoExtension: "png",
  technicianPhotoNameStyle: "space" as const,
};
function directory(names = ["Test Person"]) {
  return normalizeKitchenDirectory(
    names.map((_, i) => ({
      id: String(i),
      user_id: String(i),
      status: "ACTIVE",
    })),
    names.map((name, i) => ({
      id: String(i),
      display_name: name,
      photos: [
        { type: "PHOTO", value: `https://rippling.example.com/${i}.jpg` },
      ],
    })),
    [],
  );
}
const photo = () =>
  new Response(null, { headers: { "content-type": "image/png" } });
const missing = () => new Response(null, { status: 404 });

describe("kitchen Cloudflare photos", () => {
  it("prefers an existing Cloudflare image and retains Rippling for runtime fallback", async () => {
    const input = directory();
    const request = vi.fn().mockResolvedValue(photo());
    const result = await preferKitchenCloudflarePhotos(input, assets, request);
    expect(result.employees[0]).toMatchObject({
      photoUrl:
        "https://photos.example.com/technicians_photos/Test%20Person.png",
      photoSource: "cloudflare",
      photoFallbackUrl: "https://rippling.example.com/0.jpg",
    });
    expect(input.employees[0]?.photoUrl).toBe(
      "https://rippling.example.com/0.jpg",
    );
    expect(request).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "HEAD", redirect: "error" }),
    );
    expect(request.mock.calls[0]![1].headers).toBeUndefined();
  });

  it("retains Rippling on missing files, non-image responses, or Cloudflare errors", async () => {
    for (const request of [
      vi.fn().mockResolvedValue(missing()),
      vi
        .fn()
        .mockResolvedValue(
          new Response(null, { headers: { "content-type": "text/html" } }),
        ),
      vi.fn().mockRejectedValue(new Error("Network unavailable")),
    ]) {
      const result = await preferKitchenCloudflarePhotos(
        directory(),
        assets,
        request,
      );
      expect(result.employees[0]).toMatchObject({
        photoUrl: "https://rippling.example.com/0.jpg",
        photoSource: "rippling",
        photoFallbackUrl: null,
      });
    }
  });

  it("matches a unique shortened name after checking the full name", async () => {
    const request = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("Jonathan%20Camargo.png") ? photo() : missing(),
    );
    const result = await preferKitchenCloudflarePhotos(
      directory(["Jonathan Camargo Reyes"]),
      assets,
      request,
    );
    expect(result.employees[0]?.photoUrl).toBe(
      "https://photos.example.com/technicians_photos/Jonathan%20Camargo.png",
    );
    expect(String(request.mock.calls[0]![0])).toContain(
      "Jonathan%20Camargo%20Reyes.png",
    );
  });

  it("does not give one employee another employee's photo when shortened names overlap", async () => {
    const request = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("Alexis%20Reyes.png") ? photo() : missing(),
    );
    const result = await preferKitchenCloudflarePhotos(
      directory(["Alexis Reyes", "Alexis Reyes Perez"]),
      assets,
      request,
    );
    expect(
      result.employees.find((employee) => employee.name === "Alexis Reyes")
        ?.photoSource,
    ).toBe("cloudflare");
    expect(
      result.employees.find(
        (employee) => employee.name === "Alexis Reyes Perez",
      )?.photoSource,
    ).toBe("rippling");
    const duplicate = kitchenPhotoCandidates(
      directory(["Test Person", "TEST PERSON"]),
      assets,
    );
    expect(duplicate).toEqual([[], []]);
  });

  it("handles capitalization and accents without guessing a different name", async () => {
    const urls = new Set([
      "https://photos.example.com/technicians_photos/Uzi%20Valdez.png",
      "https://photos.example.com/technicians_photos/Manuel%20Alarcon.png",
    ]);
    const request = vi.fn(async (url: string | URL | Request) =>
      urls.has(String(url)) ? photo() : missing(),
    );
    const result = await preferKitchenCloudflarePhotos(
      directory(["uzi valdez", "Manuel Alarcón"]),
      assets,
      request,
    );
    expect(
      result.employees.every(
        (employee) => employee.photoSource === "cloudflare",
      ),
    ).toBe(true);
  });

  it("fills missing Rippling photos from Cloudflare and updates the missing-photo count", async () => {
    const input = directory();
    input.employees[0]!.photoUrl = null;
    input.quality.missingPhotos = 1;
    const result = await preferKitchenCloudflarePhotos(
      input,
      assets,
      vi.fn().mockResolvedValue(photo()),
    );
    expect(result.quality.missingPhotos).toBe(0);
    expect(result.employees[0]?.photoFallbackUrl).toBeNull();
  });

  it("makes no photo requests without Cloudflare configuration", async () => {
    const input = directory();
    const request = vi.fn();
    expect(
      await preferKitchenCloudflarePhotos(
        input,
        { ...assets, publicBaseUrl: null },
        request,
      ),
    ).toBe(input);
    expect(request).not.toHaveBeenCalled();
  });
});
