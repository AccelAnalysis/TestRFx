import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync("components/rfx/rfx-mobile-task-canvas.tsx", "utf8");
const creationEntry = readFileSync("components/rfx/rfx-mobile-create-entry.tsx", "utf8");
const reusePicker = readFileSync("components/rfx/rfx-reuse-previous.tsx", "utf8");
const workflowExtensions = readFileSync("lib/rfx/workflow-source-extensions.ts", "utf8");
const styles = readFileSync("components/rfx/rfx-workflow-surface.module.css", "utf8");
const transactionRoute = readFileSync("app/api/rfx/transactions/route.ts", "utf8");
const reusableRoute = readFileSync("app/api/rfx/reusable/route.ts", "utf8");
const workspaceRoute = readFileSync("app/api/rfx/workspaces/route.ts", "utf8");
const workspaceRepository = readFileSync("lib/rfx/postgres-repository.ts", "utf8");

describe("RFx mobile Task Canvas source contract", () => {
  it("starts creation with a plain-language need instead of workflow metadata", () => {
    expect(creationEntry).toContain("What do you need?");
    expect(creationEntry).toContain("Start in your own words");
    expect(creationEntry).toContain("mobile.needStatement");
  });

  it("supports mobile-native capture, dictation, templates, and previous RFx reuse", () => {
    expect(creationEntry).toContain("SpeechRecognition");
    expect(creationEntry).toContain('capture="environment"');
    expect(creationEntry).toContain("storeDeviceAttachment");
    expect(creationEntry).toContain("Reuse a previous RFx");
    expect(reusePicker).toContain("Use this RFx");
    expect(reusableRoute).toContain("Previous RFx");
    expect(reusableRoute).toContain("dates: false");
    expect(reusableRoute).toContain("responses: false");
    expect(reusableRoute).toContain("awardState: false");
  });

  it("uses structured mobile requirement cards and rapid fit choices", () => {
    expect(workflowExtensions).toContain("How important is it?");
    expect(workflowExtensions).toContain("Required");
    expect(workflowExtensions).toContain("Preferred");
    expect(workflowExtensions).toContain("Who must satisfy it?");
    expect(workflowExtensions).toContain("Evidence or confirmation requested");
    expect(workflowExtensions).toContain("Can we perform the work?");
    expect(workflowExtensions).toContain('["Yes", "Unsure", "No"]');
  });

  it("implements decision-first pursuit and response home", () => {
    expect(component).toContain("Why you are seeing this");
    expect(component).toContain("Pursue");
    expect(component).toContain("Continue where you left off");
    expect(component).toContain("Review & submit");
  });

  it("keeps explicit reuse confirmation, collaboration, and addenda source workflows", () => {
    expect(workflowExtensions).toContain("Confirm Reused Organization Data");
    expect(workflowExtensions).toContain("Assign Sections");
    expect(workflowExtensions).toContain("Request Information");
    expect(workflowExtensions).toContain("Track Completion");
    expect(workflowExtensions).toContain("Controlled version");
    expect(workflowExtensions).toContain("Addendum summary");
  });

  it("implements truthful hosted and external submission states", () => {
    expect(component).toContain("submission.authorized");
    expect(component).toContain("Response submitted");
    expect(component).toContain("externally submitted, self-reported");
    expect(component).toContain("will not claim formal external submission");
    expect(component).toContain("/api/rfx/transactions");
  });

  it("requires authenticated server authority for formal publish, submit, and reuse", () => {
    expect(transactionRoute).toContain("resolveRfxActor");
    expect(transactionRoute).toContain("publicationPreflight");
    expect(transactionRoute).toContain("responsePreflight");
    expect(transactionRoute).toContain("submit-hosted");
    expect(transactionRoute).toContain("record-external");
    expect(workspaceRoute).toContain("resolveRfxActor");
    expect(reusableRoute).toContain("resolveRfxActor");
    expect(reusableRoute).toContain("actorCanWriteRfx");
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
