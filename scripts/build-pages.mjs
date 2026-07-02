import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");

const files = ["index.html", "app.js", "styles.css", "_headers"];

await rm(dist, { force: true, recursive: true });
await mkdir(join(dist, "data"), { recursive: true });

await Promise.all(files.map((file) => copyFile(join(root, file), join(dist, file))));
await cp(join(root, "data"), join(dist, "data"), { recursive: true });
