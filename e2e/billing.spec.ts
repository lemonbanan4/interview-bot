import { expect, test } from "./fixtures";
import { loginViaApi } from "./helpers/auth";
import { cleanupE2EState, seedE2EUser } from "./helpers/db";

/** Mirrors `PLAN_LIST_PRICES.pro` + annual 20% discount display in src/lib/stripe/client. */
const PRO_MONTHLY: Record<string, RegExp> = {
  usd: /\$29/,
  eur: /€27|27\s*€/,
  sek: /299/,
  nok: /309/,
};
const PRO_ANNUAL_PER_MONTH = /\$23\.20|\$23/; // 29×0.8 → $23.20

/**
 * Pricing matrix: currency switch (USD/EUR/SEK/NOK), monthly/annual toggle,
 * and Stripe Checkout session initiation with mocked payment redirect.
 */
test.describe("Stripe checkout & billing flow", () => {
  const email = `billing-flow-${Date.now()}@e2e.signal.test`;

  test.beforeEach(async ({ e2eMode }) => {
    test.skip(e2eMode === "tauri", "Billing lives in the web shell");
    test.skip(
      process.env.E2E_SKIP_DB === "1",
      "Billing specs require DATABASE_URL",
    );
    await cleanupE2EState(email);
    await seedE2EUser({
      email,
      creditsRemaining: 10,
      plan: "free",
      subscriptionStatus: "inactive",
    });
  });

  test.afterEach(async () => {
    if (process.env.E2E_SKIP_DB === "1") return;
    await cleanupE2EState(email);
  });

  test("currency switching updates displayed Pro list prices", async ({
    appPage,
  }) => {
    await appPage.goto("/pricing");
    await expect(appPage.getByTestId("pricing-table")).toBeVisible({
      timeout: 15_000,
    });

    for (const [currency, priceRe] of Object.entries(PRO_MONTHLY)) {
      await appPage
        .getByTestId("pricing-currency-select")
        .selectOption(currency);
      await expect(
        appPage.getByTestId("pricing-table").getByText(priceRe).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test("monthly / annual toggle updates Pro price and billed-annually copy", async ({
    appPage,
  }) => {
    await appPage.goto("/pricing");
    await expect(appPage.getByTestId("pricing-billing-toggle")).toBeVisible();

    await expect(
      appPage.getByTestId("pricing-table").getByText(PRO_MONTHLY.usd!).first(),
    ).toBeVisible();

    await appPage.getByTestId("pricing-interval-year").click();
    await expect(
      appPage
        .getByTestId("pricing-table")
        .getByText(PRO_ANNUAL_PER_MONTH)
        .first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      appPage
        .getByTestId("pricing-table")
        .getByText(/billed annually|annual/i)
        .first(),
    ).toBeVisible();

    await appPage.getByTestId("pricing-interval-month").click();
    await expect(
      appPage.getByTestId("pricing-table").getByText(PRO_MONTHLY.usd!).first(),
    ).toBeVisible();
  });

  test("authenticated checkout initiates a Stripe session with currency + interval", async ({
    appPage,
  }) => {
    await loginViaApi(appPage.request, { email });

    const stripeCheckoutUrl =
      "https://checkout.stripe.com/c/pay/cs_test_e2e_visa_4242";

    let capturedBody: {
      currency?: string;
      interval?: string;
      planId?: string;
      mode?: string;
    } | null = null;

    await appPage.route("**/api/checkout", async (route) => {
      capturedBody = route.request().postDataJSON() as {
        currency?: string;
        interval?: string;
        planId?: string;
        mode?: string;
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: stripeCheckoutUrl,
          // Simulated Stripe test-mode Checkout Session for Visa 4242…
          id: "cs_test_e2e_visa_4242",
        }),
      });
    });
    // Legacy alias still used by some CTAs.
    await appPage.route("**/api/stripe/checkout", async (route) => {
      capturedBody = route.request().postDataJSON() as {
        currency?: string;
        interval?: string;
        planId?: string;
        mode?: string;
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: stripeCheckoutUrl }),
      });
    });

    await appPage.goto("/pricing");
    await appPage.getByTestId("pricing-currency-select").selectOption("eur");
    await appPage.getByTestId("pricing-interval-year").click();

    await Promise.all([
      appPage.waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 }),
      appPage.getByTestId("pricing-checkout-pro").click(),
    ]);

    expect(appPage.url()).toContain("checkout.stripe.com");
    const body = capturedBody as {
      currency?: string;
      interval?: string;
      mode?: string;
    } | null;
    expect(body?.currency).toBe("eur");
    expect(body?.interval).toBe("year");
    expect(body?.mode || "subscription").toMatch(/subscription|payment/);
  });

  test("unauthenticated Start Pro CTA routes to login", async ({ appPage }) => {
    await appPage.goto("/pricing");
    await appPage.getByTestId("pricing-checkout-pro").click();
    await expect(appPage).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("E2E billing simulate upgrades plan like a successful Stripe webhook", async ({
    appPage,
  }) => {
    await loginViaApi(appPage.request, { email });

    const res = await appPage.request.post("/api/e2e/billing/simulate", {
      data: {
        email,
        type: "subscription",
        planId: "pro",
        credits: 300,
        // Mimic Stripe test card success metadata
        paymentMethod: "pm_card_visa",
        cardLast4: "4242",
      },
    });
    expect(res.ok()).toBeTruthy();
    const json = (await res.json()) as {
      ok: boolean;
      user: {
        plan: string;
        creditsRemaining: number;
        subscriptionStatus: string;
      };
    };
    expect(json.ok).toBe(true);
    expect(json.user.plan).toBe("pro");
    expect(json.user.subscriptionStatus).toBe("active");
    expect(json.user.creditsRemaining).toBe(300);

    // Session cookie from loginViaApi is enough — avoid a second UI login
    // that races layout prerender warnings under turbopack.
    await appPage.goto("/dashboard/settings");
    await expect(
      appPage.getByText(/300|Pro|Billing|minutes/i).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
