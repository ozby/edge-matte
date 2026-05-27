import { test, expect } from "@playwright/test";

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

test("upload -> hosted result -> delete -> 404 runs through the browser UI", async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "EdgeMatte" })).toBeVisible();

  await page.locator("#file-input").setInputFiles({
    name: "browser-upload.png",
    mimeType: "image/png",
    buffer: PNG_BYTES,
  });

  await expect(page.locator("#status")).toContainText("Ready to upload");
  await expect(page.locator("#submit-upload")).toBeEnabled();

  await page.getByRole("button", { name: "Upload & process" }).click();

  await expect(page.locator("#result")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#status")).toContainText("Processing complete");

  const resultHref = await page.locator("#result-url").getAttribute("href");
  expect(resultHref).toBeTruthy();
  const resultUrl = new URL(resultHref, baseURL).toString();
  const jobId = new URL(resultUrl).pathname.split("/").pop();
  expect(jobId).toBeTruthy();

  const imageResponse = await request.get(resultUrl);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toMatch(/image\//u);

  await page.getByRole("button", { name: "Delete artifacts" }).click();
  await expect(page.getByText("Delete the hosted image and all stored artifacts?")).toBeVisible();
  await page.getByRole("button", { name: "Yes, delete" }).click();

  await expect(page.locator("#status")).toContainText("Artifacts deleted");
  await expect(page.locator("#result")).toBeHidden();

  const deletedImage = await request.get(resultUrl);
  expect(deletedImage.status()).toBe(404);

  const deletedJob = await request.get(`/api/jobs/${jobId}`);
  expect(deletedJob.status()).toBe(404);
});
