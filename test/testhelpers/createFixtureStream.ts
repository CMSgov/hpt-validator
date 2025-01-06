import * as fs from "fs";
import * as path from "path";

export function createFixtureStream(fixture: string) {
  return fs.createReadStream(
    new URL(path.join("..", "fixtures", fixture), import.meta.url),
    {
      encoding: "utf-8",
      highWaterMark: 1024,
    }
  );
}
