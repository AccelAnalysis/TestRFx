import React, { useMemo, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DrawerQueryState, ExchangeRecord, LensAction } from "@/lib/exchange/contracts";
import { MapCanvas } from "@/components/exchange/map-canvas";
import { ResultsDrawer } from "@/components/exchange/results-drawer";
import { DetailSurface } from "@/components/exchange/detail-surface";

const record: ExchangeRecord = { id: "rfx-test", type: "rfx", title: "Test RFx record", organization: "Test Issuer", summary: "Detail-only summary.", geography: "Norfolk, VA", metadata: ["RFP", "Due Sep 18"], location: { lat: 36.85, lng: -76.29 }, card: { classifications: ["Cybersecurity", "Services"], distance: "4 mi" } };
const query: DrawerQueryState = { sort: "relevance", location: "all", ownership: "all", savedOnly: false, featuredOnly: false };
const lensActions: LensAction[] = [1, 2, 3, 4].map((position) => ({ id: `lens-${position}`, position: position as 1 | 2 | 3 | 4, label: `Lens ${position}`, icon: "•", trigger: "direct", scope: "lens", ownership: "any", visible: true, applicable: true, authorized: true, operational: true, prerequisitesSatisfied: true }));

function SelectionHarness() {
  const [selected, setSelected] = useState<string>(); const [opened, setOpened] = useState<string>(); const [drawerQuery, setDrawerQuery] = useState(query);
  const detailRecord = opened === record.id ? record : undefined; const recordActions = useMemo<LensAction[]>(() => [], []);
  return <>
    <MapCanvas records={[record]} selectedRecordId={selected} onSelect={setSelected} resetKey={0} />
    <ResultsDrawer state="mid" onStateChange={vi.fn()} lens="rfx" lensLabel="RFx" records={[record]} selectedRecordId={selected} actions={lensActions} getRecordActions={() => recordActions} emptyMessage="No records" query={drawerQuery} onQueryChange={setDrawerQuery} onSelect={setSelected} onOpen={setOpened} onToggleSave={vi.fn()} />
    <output data-testid="selected-id">{selected ?? "none"}</output>
    {detailRecord ? <DetailSurface record={detailRecord} actions={[]} onAction={vi.fn()} onClose={() => setOpened(undefined)} /> : null}
  </>;
}

describe("shared selection and detail seams", () => {
  it("marker selection selects and reveals the corresponding card", async () => {
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView"); render(<SelectionHarness />); fireEvent.click(screen.getByRole("button", { name: "Select Test RFx record" }));
    await waitFor(() => expect(screen.getByTestId("selected-id").textContent).toBe("rfx-test")); expect(document.querySelector('[data-record-id="rfx-test"]')?.getAttribute("data-selected")).toBe("true"); expect(scrollSpy).toHaveBeenCalled();
  });

  it("card selection keeps the map marker synchronized and opens Detail", async () => {
    render(<SelectionHarness />); fireEvent.click(screen.getByRole("button", { name: "Open Test RFx record. Test Issuer" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Test RFx record details" })).toBeTruthy()); expect(screen.getByRole("button", { name: "Select Test RFx record" }).className).toContain("selected");
  });

  it("closing Detail preserves the selected card and marker state", async () => {
    render(<SelectionHarness />); fireEvent.click(screen.getByRole("button", { name: "Open Test RFx record. Test Issuer" })); await waitFor(() => expect(screen.getByRole("dialog", { name: "Test RFx record details" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "← Back" })); await waitFor(() => expect(screen.queryByRole("dialog", { name: "Test RFx record details" })).toBeNull());
    expect(document.querySelector('[data-record-id="rfx-test"]')?.getAttribute("data-selected")).toBe("true"); expect(screen.getByRole("button", { name: "Select Test RFx record" }).className).toContain("selected");
  });
});
