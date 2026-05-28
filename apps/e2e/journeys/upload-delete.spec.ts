import { expect, test } from "@playwright/test";
import { readSamplePng } from "#fixtures";

// Asymmetric committed fixture (apps/e2e/fixtures/sample.png) so a horizontal
// flip is observable in the real pipeline. In mock mode the bytes pass through,
// so the browser layer asserts the visible journey, not pixel transformation.
const SAMPLE_PNG = readSamplePng();

// Clipboard access for the "Copy URL" assertion.
test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("pick-file: upload -> ready -> copy/download -> delete -> 404", async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "EdgeMatte" })).toBeVisible();

  await page.locator("#file-input").setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: SAMPLE_PNG,
  });

  // Preview phase.
  await expect(page.locator("#preview")).toBeVisible();
  await expect(page.locator("#preview-image")).toBeVisible();
  await expect(page.locator("#status-text")).toContainText("Ready —");
  await expect(page.locator("#submit-upload")).toBeEnabled();

  await page.locator("#submit-upload").click();

  // Submit disables the controls — a stable progress signal that holds across
  // uploading/processing/ready (the transient spinner is too fast to race).
  await expect(page.locator("#submit-upload")).toBeDisabled();

  // Ready phase.
  await expect(page.locator("#result")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#status-text")).toContainText("Done. Your image is live.");

  // Hosted URL is real and serves an image.
  const resultHref = await page.locator("#result-url").getAttribute("href");
  expect(resultHref).not.toBeNull();
  const resultUrl = new URL(resultHref ?? "", baseURL ?? undefined).toString();
  expect(resultUrl).toContain("/i/");
  const jobId = new URL(resultUrl).pathname.split("/").pop() ?? "";
  expect(jobId.length).toBeGreaterThan(0);

  const served = await request.get(resultUrl);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toMatch(/image\//u);

  // Download link points at the hosted result.
  await expect(page.locator("#download-result")).toHaveAttribute("download", /.+/u);
  await expect(page.locator("#download-result")).toHaveAttribute("href", resultUrl);

  // Copy URL feedback.
  await page.locator("#copy-url").click();
  await expect(page.locator("#copy-url")).toHaveText("Copied!");

  // Delete with confirmation.
  await page.locator("#delete-job").click();
  await expect(page.locator("#delete-confirm")).toBeVisible();
  await expect(page.getByText("This will permanently remove the hosted image")).toBeVisible();
  await page.locator("#confirm-delete").click();

  await expect(page.locator("#status-text")).toContainText("Artifacts deleted");
  await expect(page.locator("#result")).toBeHidden();

  // Hosted URL and job are gone.
  expect((await request.get(resultUrl)).status()).toBe(404);
  expect((await request.get(`/api/jobs/${jobId}`)).status()).toBe(404);
});

test("drag-and-drop a file onto the drop zone enters the preview phase", async ({ page }) => {
  await page.goto("/");

  const base64 = SAMPLE_PNG.toString("base64");
  const dataTransfer = await page.evaluateHandle((b64) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "dropped.png", { type: "image/png" }));
    return dt;
  }, base64);

  await page.dispatchEvent("#drop-zone", "drop", { dataTransfer });

  await expect(page.locator("#preview")).toBeVisible();
  await expect(page.locator("#status-text")).toContainText("Ready —");
});

test("selecting a non-image surfaces a recoverable client-side error", async ({ page }) => {
  await page.goto("/");

  await page.locator("#file-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });

  await expect(page.locator("#error")).toBeVisible();
  await expect(page.locator("#error")).toContainText("Choose a PNG, JPEG, or WebP image.");
  await expect(page.locator("#preview")).toBeHidden();
});
