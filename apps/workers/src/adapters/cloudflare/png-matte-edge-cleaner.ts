const PNG_SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const COLOR_TYPE_RGB = 2;
const COLOR_TYPE_RGBA = 6;
const EDGE_ALPHA_CUTOFF = 128;
const BACKGROUND_DISTANCE_TOLERANCE = 96;

interface DecodedPngRgba {
  width: number;
  height: number;
  rgba: Uint8Array;
}

interface PngChunk {
  type: string;
  data: Uint8Array;
}

const textDecoder = new TextDecoder("ascii");
const textEncoder = new TextEncoder();

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] ?? 0) << 24) |
  ((bytes[offset + 1] ?? 0) << 16) |
  ((bytes[offset + 2] ?? 0) << 8) |
  (bytes[offset + 3] ?? 0);

const writeUint32 = (bytes: Uint8Array, offset: number, value: number): void => {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
};

const assertSignature = (bytes: Uint8Array): void => {
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error("expected PNG signature");
    }
  }
};

const parseChunks = (bytes: Uint8Array): PngChunk[] => {
  assertSignature(bytes);
  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset) >>> 0;
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;
    if (crcEnd > bytes.length) {
      throw new Error("truncated PNG chunk");
    }
    const type = textDecoder.decode(bytes.slice(typeStart, dataStart));
    chunks.push({ type, data: bytes.slice(dataStart, dataEnd) });
    offset = crcEnd;
    if (type === "IEND") break;
  }
  return chunks;
};

const toArrayBuffer = (bytes: Uint8Array<ArrayBufferLike>): ArrayBuffer =>
  new Uint8Array(bytes).buffer as ArrayBuffer;

const inflate = async (bytes: Uint8Array<ArrayBufferLike>): Promise<Uint8Array> => {
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const deflate = async (bytes: Uint8Array<ArrayBufferLike>): Promise<Uint8Array> => {
  const stream = new Blob([toArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const paethPredictor = (left: number, above: number, upperLeft: number): number => {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
};

const unfilter = (
  filtered: Uint8Array,
  width: number,
  height: number,
  channels: number,
): Uint8Array => {
  const stride = width * channels;
  const raw = new Uint8Array(stride * height);
  let inputOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = filtered[inputOffset];
    inputOffset += 1;
    const rowOffset = row * stride;
    const priorRowOffset = rowOffset - stride;
    for (let column = 0; column < stride; column += 1) {
      const value = filtered[inputOffset + column] ?? 0;
      const left = column >= channels ? (raw[rowOffset + column - channels] ?? 0) : 0;
      const above = row > 0 ? (raw[priorRowOffset + column] ?? 0) : 0;
      const upperLeft =
        row > 0 && column >= channels ? (raw[priorRowOffset + column - channels] ?? 0) : 0;
      switch (filter) {
        case 0:
          raw[rowOffset + column] = value;
          break;
        case 1:
          raw[rowOffset + column] = (value + left) & 0xff;
          break;
        case 2:
          raw[rowOffset + column] = (value + above) & 0xff;
          break;
        case 3:
          raw[rowOffset + column] = (value + Math.floor((left + above) / 2)) & 0xff;
          break;
        case 4:
          raw[rowOffset + column] = (value + paethPredictor(left, above, upperLeft)) & 0xff;
          break;
        default:
          throw new Error(`unsupported PNG filter ${filter}`);
      }
    }
    inputOffset += stride;
  }
  return raw;
};

export const decodePngRgba = async (input: Blob): Promise<DecodedPngRgba> => {
  const chunks = parseChunks(new Uint8Array(await input.arrayBuffer()));
  const ihdr = chunks.find((chunk) => chunk.type === "IHDR")?.data;
  if (!ihdr) throw new Error("missing PNG IHDR");

  const width = readUint32(ihdr, 0) >>> 0;
  const height = readUint32(ihdr, 4) >>> 0;
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compression = ihdr[10];
  const filter = ihdr[11];
  const interlace = ihdr[12];
  if (bitDepth !== 8 || compression !== 0 || filter !== 0 || interlace !== 0) {
    throw new Error("unsupported PNG encoding");
  }
  if (colorType !== COLOR_TYPE_RGB && colorType !== COLOR_TYPE_RGBA) {
    throw new Error(`unsupported PNG color type ${colorType}`);
  }

  const idatBytes = chunks
    .filter((chunk) => chunk.type === "IDAT")
    .reduce((size, chunk) => size + chunk.data.length, 0);
  if (idatBytes === 0) throw new Error("missing PNG IDAT");
  const idat = new Uint8Array(idatBytes);
  let idatOffset = 0;
  for (const chunk of chunks) {
    if (chunk.type !== "IDAT") continue;
    idat.set(chunk.data, idatOffset);
    idatOffset += chunk.data.length;
  }

  const channels = colorType === COLOR_TYPE_RGBA ? 4 : 3;
  const raw = unfilter(await inflate(idat), width, height, channels);
  const rgba = new Uint8Array(width * height * 4);
  for (let source = 0, target = 0; target < rgba.length; source += channels, target += 4) {
    rgba[target] = raw[source] ?? 0;
    rgba[target + 1] = raw[source + 1] ?? 0;
    rgba[target + 2] = raw[source + 2] ?? 0;
    rgba[target + 3] = colorType === COLOR_TYPE_RGBA ? (raw[source + 3] ?? 0) : 255;
  }
  return { width, height, rgba };
};

let crcTable: Uint32Array | null = null;

const getCrcTable = (): Uint32Array => {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[i] = c >>> 0;
  }
  return crcTable;
};

const crc32 = (parts: Uint8Array<ArrayBufferLike>[]): number => {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const part of parts) {
    for (const byte of part) {
      crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const makeChunk = (
  type: string,
  data: Uint8Array<ArrayBufferLike> = new Uint8Array(),
): Uint8Array => {
  const typeBytes = textEncoder.encode(type);
  const chunk = new Uint8Array(12 + data.length);
  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32([typeBytes, data]));
  return chunk;
};

export const encodePngRgba = async ({ width, height, rgba }: DecodedPngRgba): Promise<Blob> => {
  const scanlines = new Uint8Array(height * (1 + width * 4));
  for (let row = 0; row < height; row += 1) {
    const scanlineOffset = row * (1 + width * 4);
    scanlines[scanlineOffset] = 0;
    scanlines.set(rgba.slice(row * width * 4, (row + 1) * width * 4), scanlineOffset + 1);
  }

  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, width);
  writeUint32(ihdr, 4, height);
  ihdr[8] = 8;
  ihdr[9] = COLOR_TYPE_RGBA;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return new Blob(
    [
      toArrayBuffer(PNG_SIGNATURE),
      toArrayBuffer(makeChunk("IHDR", ihdr)),
      toArrayBuffer(makeChunk("IDAT", await deflate(scanlines))),
      toArrayBuffer(makeChunk("IEND")),
    ],
    { type: "image/png" },
  );
};

const colorDistance = (
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number => Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);

const dominantLowAlphaColor = (rgba: Uint8Array): [number, number, number] | null => {
  const counts = new Map<string, { color: [number, number, number]; count: number }>();
  for (let index = 0; index < rgba.length; index += 4) {
    const alpha = rgba[index + 3] ?? 0;
    if (alpha === 0 || alpha > EDGE_ALPHA_CUTOFF) continue;
    const r = rgba[index] ?? 0;
    const g = rgba[index + 1] ?? 0;
    const b = rgba[index + 2] ?? 0;
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, { color: [r, g, b], count: 1 });
    }
  }

  let best: { color: [number, number, number]; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best?.color ?? null;
};

export const cleanPngMatteEdges = async (input: Blob): Promise<Blob> => {
  const decoded = await decodePngRgba(input);
  const background = dominantLowAlphaColor(decoded.rgba);
  let changed = false;

  for (let index = 0; index < decoded.rgba.length; index += 4) {
    const alpha = decoded.rgba[index + 3] ?? 0;
    if (alpha === 0) {
      if (
        decoded.rgba[index] !== 0 ||
        decoded.rgba[index + 1] !== 0 ||
        decoded.rgba[index + 2] !== 0
      ) {
        decoded.rgba[index] = 0;
        decoded.rgba[index + 1] = 0;
        decoded.rgba[index + 2] = 0;
        changed = true;
      }
      continue;
    }

    if (!background || alpha > EDGE_ALPHA_CUTOFF) continue;
    const distance = colorDistance(
      decoded.rgba[index] ?? 0,
      decoded.rgba[index + 1] ?? 0,
      decoded.rgba[index + 2] ?? 0,
      background[0],
      background[1],
      background[2],
    );
    if (distance <= BACKGROUND_DISTANCE_TOLERANCE) {
      decoded.rgba[index] = 0;
      decoded.rgba[index + 1] = 0;
      decoded.rgba[index + 2] = 0;
      decoded.rgba[index + 3] = 0;
      changed = true;
    }
  }

  return changed ? encodePngRgba(decoded) : input;
};
