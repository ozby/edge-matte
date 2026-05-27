import { vi } from "vitest";

// jsdom does not implement blob URLs; assign directly so tests survive unstubAllGlobals.
URL.createObjectURL = vi.fn(() => "blob:preview") as typeof URL.createObjectURL;
URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
