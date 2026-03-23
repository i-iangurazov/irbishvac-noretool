import { describe, expect, it } from "vitest";
import {
  formatAssetName,
  resolveLogoUrl,
  resolveTechnicianPhotoUrl,
} from "./assets";

describe("formatAssetName", () => {
  it("slugifies names by default", () => {
    expect(formatAssetName("Eduardo Loera-Gaeta")).toBe("eduardo-loera-gaeta");
  });

  it("supports underscore and space variants", () => {
    expect(formatAssetName("Jonathan Camargo", "underscore")).toBe("jonathan_camargo");
    expect(formatAssetName("Jonathan Camargo", "space")).toBe("Jonathan Camargo");
    expect(formatAssetName("Jacobo Z. Tol Pixcar", "space")).toBe("Jacobo Z. Tol Pixcar");
  });
});

describe("resolveTechnicianPhotoUrl", () => {
  it("keeps absolute URLs unchanged", () => {
    expect(
      resolveTechnicianPhotoUrl({
        publicBaseUrl: "https://assets.example.com",
        folder: "techs",
        name: "Eduardo Loera-Gaeta",
        photoUrl: "https://cdn.example.com/eduardo.png",
      }),
    ).toBe("https://cdn.example.com/eduardo.png");
  });

  it("joins a relative key under the configured public base", () => {
    expect(
      resolveTechnicianPhotoUrl({
        publicBaseUrl: "https://assets.example.com",
        folder: "techs",
        name: "Eduardo Loera-Gaeta",
        photoUrl: "service/eduardo.png",
      }),
    ).toBe("https://assets.example.com/techs/service/eduardo.png");
  });

  it("builds a name-based fallback when no explicit photo is provided", () => {
    expect(
      resolveTechnicianPhotoUrl({
        publicBaseUrl: "https://assets.example.com",
        folder: "techs",
        name: "Eduardo Loera-Gaeta",
        extension: "webp",
        nameStyle: "slug",
      }),
    ).toBe("https://assets.example.com/techs/eduardo-loera-gaeta.webp");
  });
});

describe("resolveLogoUrl", () => {
  it("builds the public logo URL", () => {
    expect(
      resolveLogoUrl({
        publicBaseUrl: "https://assets.example.com",
        folder: "logos",
        key: "irbis-mark.svg",
      }),
    ).toBe("https://assets.example.com/logos/irbis-mark.svg");
  });
});
