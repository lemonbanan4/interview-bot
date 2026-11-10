import { describe, expect, it } from "vitest";
import {
  buildRegionalCoachingPrompt,
  getResumeTemplate,
  regionFromLocale,
} from "@/lib/onboarding";
import { sanitizePreferencePatch } from "@/lib/onboarding/preferences";

describe("region-aware onboarding templates", () => {
  it("maps locales to default regions", () => {
    expect(regionFromLocale("sv")).toBe("nordics");
    expect(regionFromLocale("de")).toBe("eu");
    expect(regionFromLocale("ja")).toBe("apac");
    expect(regionFromLocale("en")).toBe("us");
  });

  it("returns EU CV template for european region", () => {
    const template = getResumeTemplate("eu");
    expect(template.id).toBe("eu_cv");
    expect(template.sections).toContain("languages");
    expect(template.avoid).not.toContain("photo");
  });

  it("builds coaching prompt from wizard prefs", () => {
    const prompt = buildRegionalCoachingPrompt({
      region: "uk",
      targetRole: "product_manager",
      experienceLevel: "senior",
      preferredLanguage: "en",
      targetCompanies: ["Stripe", "Deepgram"],
    });
    expect(prompt).toMatch(/UK/i);
    expect(prompt).toMatch(/product manager/i);
    expect(prompt).toMatch(/Stripe/);
  });

  it("sanitizes preference patches", () => {
    const patch = sanitizePreferencePatch({
      region: "NORDICS",
      experienceLevel: "senior",
      preferredLanguage: "sv",
      targetCompanies: [" Klarna ", "", "x".repeat(100)],
      onboardingWizardStep: 2.8,
    });
    expect(patch.region).toBe("nordics");
    expect(patch.experienceLevel).toBe("senior");
    expect(patch.preferredLanguage).toBe("sv");
    expect(patch.targetCompanies).toEqual(["Klarna"]);
    expect(patch.onboardingWizardStep).toBe(2);
  });
});
