import { hashPassword } from "../lib/security";
// Nessuna password negli argomenti shell o nella cronologia.
process.stdout.write("Password admin (almeno 12 caratteri; input nascosto): ");
if (process.stdin.isTTY) process.stdin.setRawMode(true);
let value = "";
process.stdin.resume();
process.stdin.on("data", async (chunk: Buffer) => {
  for (const c of chunk.toString()) {
    if (c === "\u0003") process.exit(130);
    if (c === "\r" || c === "\n") {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.pause();
      if (value.length < 12 || value.length > 256) {
        console.error("\nUsa da 12 a 256 caratteri.");
        process.exit(1);
      }
      console.log("\nADMIN_PASSWORD_HASH=" + (await hashPassword(value)));
      process.exit(0);
    } else if (c === "\u007f") value = value.slice(0, -1);
    else value += c;
  }
});
