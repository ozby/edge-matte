export interface ImagesBindingResult {
  response(): Promise<Response>;
}

export interface ImagesBindingTransform {
  transform(options: { flip?: "h"; segment?: "foreground" }): ImagesBindingTransform;
  output(options: { format: "image/png" }): Promise<ImagesBindingResult>;
}

export interface ImagesBinding {
  input(stream: ReadableStream): ImagesBindingTransform;
}
