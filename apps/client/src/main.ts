// Self-hosted fonts via @fontsource — no third-party request to fonts.googleapis.com.
// DM Sans is a variable font (wght 100-1000); DM Mono ships static weights and we
// only use 400, so we import that single subset to keep the CSS payload tight.
import "@fontsource-variable/dm-sans";
import "@fontsource/dm-mono/400.css";
import "./styles.css";
import { createApp } from "./app";

const mount = document.querySelector("#app");
if (!(mount instanceof HTMLElement)) {
  throw new Error("Missing #app mount point");
}

createApp(mount);
