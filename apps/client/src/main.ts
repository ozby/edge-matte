import "./styles.css";
import { createApp } from "./app";

const mount = document.querySelector("#app");
if (!(mount instanceof HTMLElement)) {
  throw new Error("Missing #app mount point");
}

createApp(mount);
