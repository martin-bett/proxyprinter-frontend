import "fake-indexeddb/auto";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import CacheManagerDialog from "./CacheManagerDialog";
import { imageLoaderService } from "../../service/cache/ImageLoaderService";

const entry = (apiName: string, name: string, locked?: boolean) => ({ sizeBytes: 1024 * 1024, cardInput: { apiName, name }, locked });

jest.mock("../../service/cache/hooks/useImageLoaderCache", () => ({
  useImageLoaderCache: () => {
    const bolt = [entry("Scryfall", "Bolt", true), entry("MPC", "Bolt")];
    const opt = [entry("Scryfall", "Opt")];
    return {
      byApi: { Scryfall: [bolt[0], opt[0]], MPC: [bolt[1]] },
      byCard: { Bolt: bolt, Opt: opt },
      totalSize: 3 * 1024 * 1024,
      lockedCount: 1,
    };
  },
}));
jest.mock("./CacheProgressBar", () => ({ CacheProgressBar: () => null }));

describe("CacheManagerDialog Schloss", () => {
  // Der Service prüft beim Start den Cache; ohne Warten loggt er erst nach Testende
  beforeAll(() => imageLoaderService.ready);

  it("zeigt den Schutzstatus, Klick aufs Schloss schützt die Gruppe statt zu löschen", () => {
    const setLocked = jest.spyOn(imageLoaderService, "setLocked").mockResolvedValue();
    const deleteUnlocked = jest.spyOn(imageLoaderService, "deleteUnlocked").mockResolvedValue();
    render(<CacheManagerDialog open onClose={() => {}} />);

    expect(screen.getByText(/1 protected/)).toBeInTheDocument();
    const boltRow = screen.getByText("Bolt").closest("tr")!;
    const cells = boltRow.querySelectorAll("td");
    // Scryfall: Count, MB, Lock | MPC: Count, MB, Lock | All APIs: Count, MB, Lock
    expect(cells[2].className).toContain("is-locked");
    expect(cells[5].className).toContain("is-unlocked");
    expect(cells[8].className).toContain("is-partial");

    // Bolt bei Scryfall ist geschützt: nichts zu löschen
    expect(cells[0].className).toContain("is-empty");

    fireEvent.mouseEnter(cells[5]);
    expect(cells[3].className).toContain("is-protect-lock");
    expect(cells[4].className).toContain("is-protect-lock");
    expect(cells[0].className).not.toContain("is-protect");

    fireEvent.click(cells[5]);
    expect(setLocked).toHaveBeenCalledWith({ apiName: "MPC", cardName: "Bolt" }, true);
    fireEvent.click(cells[2]);
    expect(setLocked).toHaveBeenCalledWith({ apiName: "Scryfall", cardName: "Bolt" }, false);
    expect(deleteUnlocked).not.toHaveBeenCalled();

    fireEvent.click(cells[3]);
    expect(deleteUnlocked).toHaveBeenCalledWith({ apiName: "MPC", cardName: "Bolt" });
  });
});
