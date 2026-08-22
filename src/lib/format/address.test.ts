import { describe, expect, it } from "vitest";
import { checksum, scannerUrl, shortenAddress, shortenHash } from "./address";

describe("shortenAddress", () => {
  it("shortens with default size 4", () => {
    expect(shortenAddress("0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D")).toBe("0x24F0\u2026151D");
  });

  it("shortens with custom size", () => {
    expect(shortenAddress("0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D", 6)).toBe(
      "0x24F015\u2026B8151D",
    );
  });
});

describe("shortenHash", () => {
  it("shortens a 32-byte tx hash without address validation", () => {
    const hash = "0xec6ad9a4ea06082620ac6c5362714a8de1f5723a70cb97c69e04d4616cb1c1a5";
    expect(shortenHash(hash, 6)).toBe("0xec6ad9\u2026b1c1a5");
  });

  it("shortens with default size 6", () => {
    const hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    expect(shortenHash(hash)).toBe("0x123456\u2026abcdef");
  });

  it("does not throw on a 32-byte hash (unlike getAddress)", () => {
    const hash = "0xec6ad9a4ea06082620ac6c5362714a8de1f5723a70cb97c69e04d4616cb1c1a5";
    expect(() => shortenHash(hash)).not.toThrow();
  });
});

describe("checksum", () => {
  it("EIP-55 checksums an address", () => {
    expect(checksum("0x24f0154c1dce548adf15da2098fdd8b8a3b8151d")).toBe(
      "0x24F0154C1dCe548AdF15da2098Fdd8B8A3B8151D",
    );
  });
});

describe("scannerUrl", () => {
  it("builds an address URL", () => {
    expect(scannerUrl("0xabc", "address")).toBe("https://ipfs.scan.pulsechain.com/address/0xabc");
  });

  it("builds a tx URL", () => {
    expect(scannerUrl("0xdef", "tx")).toBe("https://ipfs.scan.pulsechain.com/tx/0xdef");
  });
});
