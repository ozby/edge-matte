import { AppError } from "../../core/errors";
import type { BackgroundRemovalProvider } from "../../ports";

export class PhotoroomProvider implements BackgroundRemovalProvider {
  constructor(private readonly apiKey?: string) {}

  async removeBackground(input: Blob): Promise<Blob> {
    if (!this.apiKey) {
      return input;
    }

    const formData = new FormData();
    formData.set(
      "image_file",
      new File([input], "upload.png", { type: input.type || "image/png" }),
    );

    const response = await fetch("https://sdk.photoroom.com/v1/segment", {
      method: "POST",
      headers: { "x-api-key": this.apiKey },
      body: formData,
    });
    if (!response.ok) {
      throw new AppError(502, "background_provider_failed");
    }
    return response.blob();
  }
}
