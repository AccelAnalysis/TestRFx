import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync("components/rfx/rfx-mobile-task-canvas.tsx", "utf8");
const styles = readFileSync("components/rfx/rfx-workflow-surface.module.css", "utf8");
const transactionRoute = readFileSync("app/api/rfx/transactions/route.ts", "utf8");
const workspaceRoute = readFileSync("app/api/rfx/workspaces/route.ts", "utf8");
const workspaceRepository = readFileSync("lib/rfx/postgres-repository.ts", "utf8");

describe("RFx mobile Task Canvas source contract", () => {
  it("starts creation with a plain-language need instead of workflow metadata", () => {
    expect(component).toContain("What do you need?");
    expect(component).toContain("Start in your own words");
    expect(component).toContain("mobile.needStatement");
  });

  it("supports mobile-native capture and dictation", () => {
    expect(component).toContain("SpeechRecognition");
    expect(component).toContain('capture="environment"');
    expect(component).toContain("storeDeviceAttachment");
  });

  it("implements decision-first pursuit and response home", () => {
    expect(component).toContain("Why you are seeing this");
    expect(component).toContain("Pursue");
    expect(component).toContain("Continue where you left off");
    expect(component).toContain("Review & submit");
  });

  it("implements truthful hosted and external submission states", () => {
    expect(component).toContain("submission.authorized");
    expect(component).toContain("Response submitted");
    expect(component).toContain("externally submitted, self-reported");
    expect(component).toContain("will not claim formal external submission");
    expect(component).toContain("/api/rfx/transactions");
  });

  it("requires authenticated server authority for formal publish and submit", () => {
    expect(transactionRoute).toContain("resolveRfxActor");
    expect(transactionRoute).toContain("publicationPreflight");
    expect(transactionRoute).toContain("responsePreflight");
    expect(transactionRoute).toContain("submit-hosted");
    expect(transactionRoute).toContain("record-external");
    expect(workspaceRoute).toContain("resolveRfxActor");
  });

  it("isolates shared responder work by active organization", () => {
    expect(workspaceRepository).toContain("organization_id");
    expect(workspaceRepository).toContain("rfx_workspaces_org_unique");
    expect(workspaceRepository).toContain("actor.organizationId");
  });

  it("keeps primary actions in the mobile thumb zone and supports small screens", () => {
    expect(styles).toContain("position: fixed");
    expect(styles).toContain("100dvh");
    expect(styles).toContain("env(safe-area-inset-bottom)");
    expect(styles).toContain("@media (max-width: 360px)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("does not render the old workflow-engine metadata strip", () => {
    expect(component).not.toContain("workspaceMeta");
    expect(component).not.toContain("Shared Postgres workspace");
    expect(component).not.toContain("Local device workspace");
  });
});
