import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync("components/rfx/rfx-workflow-surface.tsx", "utf8");
const styles = readFileSync("components/rfx/rfx-workflow-surface.module.css", "utf8");

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
