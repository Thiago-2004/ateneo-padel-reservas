import fs from "fs";
import path from "path";

const dataDir = "./data";
const backupDir = "./backups";

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const date = new Date().toISOString().slice(0, 10);

const files = ["ateneo.db", "ateneo.db-wal", "ateneo.db-shm"];

for (const file of files) {
  const src = path.join(dataDir, file);
  if (fs.existsSync(src)) {
    const dest = path.join(backupDir, `${file}-${date}`);
    fs.copyFileSync(src, dest);
  }
}

console.log("✅ Backup completo SQLite (db + wal + shm) creado");
