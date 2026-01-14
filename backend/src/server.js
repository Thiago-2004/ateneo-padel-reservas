// backend/src/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

import { initDB } from "./db.js";
import { signToken, hashPassword, verifyPassword } from "./auth.js";
import { requireAuth, requireAdmin } from "./middleware.js";

const app = express();

// =======================
// ✅ ENV / CONFIG (IMPORTANTE: antes de usar FRONTEND_URL en cors)
// =======================
const PORT = process.env.PORT || 4001;
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const DB_PATH = process.env.DB_PATH || "./data/ateneo.db";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_URL_2 = process.env.FRONTEND_URL_2 || "";

const allowedOrigins = [FRONTEND_URL, FRONTEND_URL_2].filter(Boolean);

const DEPOSIT_AMOUNT = 10000;
const RESET_TTL_MIN = Number(process.env.RESET_TTL_MIN || 15);


// =======================
// ✅ MIDDLEWARES
// =======================
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // Postman/curl
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(express.json());

// =======================
// ✅ DB
// =======================
const db = initDB(DB_PATH);

// =======================
// 📧 MAILER (Nodemailer)
// =======================
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER;

function mailerReady() {
  return SMTP_HOST && SMTP_USER && SMTP_PASS;
}

const transporter = mailerReady()
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    })
  : null;

// =======================
// ADMIN INICIAL
// =======================
async function ensureInitialAdmin() {
  const exists = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
  if (!exists) {
    const email = "admin@ateneo.com";
    const pass = "Admin12345!";
    const ph = await hashPassword(pass);

    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?, 'admin')")
      .run("Admin Ateneo", email, ph);

    console.log("✅ Admin inicial creado:");
    console.log("   email:", email);
    console.log("   pass :", pass);
  }
}
ensureInitialAdmin().catch(console.error);

// =======================
// HELPERS RESERVAS
// =======================
function isBlockingPaymentStatus(ps) {
  return ps === "pending" || ps === "reported" || ps === "approved";
}

// =======================
// 🔐 RESET HELPERS
// =======================
function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function nowPlusMinutes(mins) {
  // devuelve string sqlite datetime
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function cleanupExpiredResetTokens() {
  db.prepare(`
    DELETE FROM password_reset_tokens
    WHERE used_at IS NULL
      AND expires_at < datetime('now')
  `).run();
}

// corre cada 30 min
setInterval(() => {
  try {
    cleanupExpiredResetTokens();
  } catch (e) {
    console.error("❌ cleanup tokens:", e);
  }
}, 30 * 60 * 1000);

// =======================
// AUTH
// =======================
app.post("/auth/register", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { name, email, password } = parsed.data;

  const existing = db.prepare("SELECT id FROM users WHERE email=?").get(email);
  if (existing) return res.status(409).json({ error: "Email ya registrado" });

  const password_hash = await hashPassword(password);

  const r = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?, 'user')")
    .run(name, email, password_hash);

  const user = db
    .prepare("SELECT id, name, email, role FROM users WHERE id=?")
    .get(r.lastInsertRowid);

  const token = signToken(user, JWT_SECRET);

  res.json({ token, user });
});

app.post("/auth/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;

  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  const safeUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  const token = signToken(safeUser, JWT_SECRET);

  res.json({ token, user: safeUser });
});

app.get("/me", requireAuth(JWT_SECRET), (req, res) => {
  res.json({ user: req.user });
});

// =======================
// 🔐 FORGOT PASSWORD (manda email real)
// =======================
app.post("/auth/forgot", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email } = parsed.data;

  // siempre respondemos OK para no filtrar si existe o no
  const user = db.prepare("SELECT id, email, name FROM users WHERE email=?").get(email);
  if (!user) return res.json({ ok: true });

  // genera token
  const rawToken = crypto.randomBytes(32).toString("hex");
  const token_hash = sha256(rawToken);
  const expires_at = nowPlusMinutes(RESET_TTL_MIN);

  // invalida tokens anteriores no usados de ese user
  db.prepare(`
    UPDATE password_reset_tokens
    SET used_at = datetime('now')
    WHERE user_id = ? AND used_at IS NULL
  `).run(user.id);

  db.prepare(`
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES (?,?,?)
  `).run(user.id, token_hash, expires_at);

  const resetLink = `${FRONTEND_URL}/reset?token=${rawToken}`;

  // si no hay smtp configurado: devolvemos el link para desarrollo
  if (!mailerReady()) {
    console.log("⚠️ SMTP no configurado. Link reset:", resetLink);
    return res.json({ ok: true, dev_reset_link: resetLink });
  }

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to: user.email,
      subject: "ATENEO PADEL - Reset de contraseña",
      html: `
        <div style="font-family:Arial,sans-serif">
          <h2>Reset de contraseña</h2>
          <p>Hola ${user.name || ""},</p>
          <p>Hacé click para cambiar tu contraseña (expira en ${RESET_TTL_MIN} minutos):</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>Si no lo pediste, ignorá este mensaje.</p>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("❌ Error enviando email:", e);
    res.json({ ok: true });
  }
});

// =======================
// 🔐 RESET PASSWORD (con token)
// =======================
app.post("/auth/reset", async (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    newPassword: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { token, newPassword } = parsed.data;
  const token_hash = sha256(token);

  const row = db.prepare(`
    SELECT prt.*, u.id as uid
    FROM password_reset_tokens prt
    JOIN users u ON u.id = prt.user_id
    WHERE prt.token_hash = ?
    LIMIT 1
  `).get(token_hash);

  if (!row) return res.status(400).json({ error: "Token inválido" });
  if (row.used_at) return res.status(400).json({ error: "Token ya usado" });

  const expired = db.prepare(`SELECT datetime('now') > ? as exp`).get(row.expires_at)?.exp;
  if (expired) return res.status(400).json({ error: "Token expirado" });

  const password_hash = await hashPassword(newPassword);

  db.prepare(`UPDATE users SET password_hash=? WHERE id=?`).run(password_hash, row.user_id);
  db.prepare(`UPDATE password_reset_tokens SET used_at=datetime('now') WHERE id=?`).run(row.id);

  res.json({ ok: true });
});

// =======================
// USERS (ADMIN)
// =======================
app.get("/users", requireAuth(JWT_SECRET), requireAdmin, (req, res) => {
  const users = db
    .prepare("SELECT id, name, email, role, created_at FROM users ORDER BY id DESC")
    .all();
  res.json({ users });
});

app.post("/users/promote", requireAuth(JWT_SECRET), requireAdmin, (req, res) => {
  const schema = z.object({ userId: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { userId } = parsed.data;
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(userId);
  res.json({ ok: true });
});

// =======================
// RESERVATIONS
// =======================
app.get("/reservations", requireAuth(JWT_SECRET), (req, res) => {
  const { dateFrom, dateTo } = req.query;

  let rows;
  if (dateFrom && dateTo) {
    rows = db
      .prepare(`
        SELECT * FROM reservations
        WHERE date BETWEEN ? AND ?
        ORDER BY date ASC, start_time ASC
      `)
      .all(dateFrom, dateTo);
  } else {
    rows = db
      .prepare(`
        SELECT * FROM reservations
        ORDER BY date DESC, start_time ASC
        LIMIT 200
      `)
      .all();
  }

  res.json({ reservations: rows });
});

app.get("/reservations/:id", requireAuth(JWT_SECRET), (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM reservations WHERE id=?").get(id);
  if (!row) return res.status(404).json({ error: "No existe" });

  const isOwner = row.user_id === req.user.id;
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ error: "No permitido" });

  res.json({ reservation: row });
});

app.post("/reservations", requireAuth(JWT_SECRET), (req, res) => {
  const schema = z.object({
    court: z.number().int().min(1).max(2),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    duration_min: z.union([z.literal(60), z.literal(90), z.literal(120)]),
    notes: z.string().max(200).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { court, date, start_time, duration_min, notes } = parsed.data;

  const exists = db
    .prepare(`
      SELECT id, payment_status FROM reservations
      WHERE court=? AND date=? AND start_time=? AND status='active'
    `)
    .get(court, date, start_time);

  if (exists && isBlockingPaymentStatus(exists.payment_status)) {
    return res.status(409).json({ error: "Ese horario ya está reservado (o pendiente de pago)" });
  }

  const isAdmin = req.user.role === "admin";
  const payment_status = isAdmin ? "approved" : "pending";
  const deposit_amount = isAdmin ? 0 : DEPOSIT_AMOUNT;

  const r = db
    .prepare(`
      INSERT INTO reservations (
        user_id, user_name, user_email,
        court, date, start_time, duration_min,
        status, notes,
        payment_status, deposit_amount, payment_updated_at
      )
      VALUES (?,?,?,?,?,?,?, 'active', ?, ?, ?, datetime('now'))
    `)
    .run(
      req.user.id,
      req.user.name,
      req.user.email,
      court,
      date,
      start_time,
      duration_min,
      notes ?? null,
      payment_status,
      deposit_amount
    );

  const created = db.prepare("SELECT * FROM reservations WHERE id=?").get(r.lastInsertRowid);

  res.json({
    ok: true,
    reservationId: created.id,
    deposit_amount: created.deposit_amount,
    payment_status: created.payment_status,
    reservation: created,
  });
});

app.post("/reservations/:id/report-payment", requireAuth(JWT_SECRET), (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM reservations WHERE id=?").get(id);
  if (!row) return res.status(404).json({ error: "No existe" });

  const isOwner = row.user_id === req.user.id;
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ error: "No permitido" });

  if (row.status !== "active") return res.status(400).json({ error: "Reserva cancelada" });
  if (row.payment_status === "approved") return res.json({ ok: true, reservation: row });
  if (row.payment_status === "rejected") return res.status(400).json({ error: "Pago rechazado" });

  db.prepare(`
    UPDATE reservations
    SET payment_status='reported', payment_updated_at=datetime('now')
    WHERE id=?
  `).run(id);

  const updated = db.prepare("SELECT * FROM reservations WHERE id=?").get(id);
  res.json({ ok: true, reservation: updated });
});

app.delete("/reservations/:id", requireAuth(JWT_SECRET), (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM reservations WHERE id=?").get(id);
  if (!row) return res.status(404).json({ error: "No existe" });

  const isOwner = row.user_id === req.user.id;
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ error: "No permitido" });

  db.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").run(id);
  res.json({ ok: true });
});

app.patch("/reservations/:id", requireAuth(JWT_SECRET), requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  const schema = z.object({
    court: z.number().int().min(1).max(2).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    duration_min: z.union([z.literal(60), z.literal(90), z.literal(120)]).optional(),
    notes: z.string().max(200).optional(),
    status: z.enum(["active", "cancelled"]).optional(),
    payment_status: z.enum(["pending", "reported", "approved", "rejected"]).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const current = db.prepare("SELECT * FROM reservations WHERE id=?").get(id);
  if (!current) return res.status(404).json({ error: "No existe" });

  const next = {
    ...current,
    ...parsed.data,
    payment_status: parsed.data.payment_status ?? current.payment_status,
  };

  if (next.court !== current.court || next.date !== current.date || next.start_time !== current.start_time) {
    const conflict = db
      .prepare(`
        SELECT id, payment_status FROM reservations
        WHERE id <> ? AND court=? AND date=? AND start_time=? AND status='active'
      `)
      .get(id, next.court, next.date, next.start_time);

    if (conflict && isBlockingPaymentStatus(conflict.payment_status)) {
      return res.status(409).json({ error: "Conflicto: horario ocupado (o pendiente de pago)" });
    }
  }

  db.prepare(`
    UPDATE reservations
    SET court=?, date=?, start_time=?, duration_min=?, notes=?, status=?,
        payment_status=?, payment_updated_at=datetime('now')
    WHERE id=?
  `).run(
    next.court,
    next.date,
    next.start_time,
    next.duration_min,
    next.notes ?? null,
    next.status,
    next.payment_status,
    id
  );

  const updated = db.prepare("SELECT * FROM reservations WHERE id=?").get(id);
  res.json({ reservation: updated });
});

// =======================
// ADMIN PAGOS
// =======================
app.get("/admin/reservations/pending", requireAuth(JWT_SECRET), requireAdmin, (req, res) => {
  const rows = db
    .prepare(`
      SELECT *
      FROM reservations
      WHERE status='active'
        AND payment_status IN ('pending','reported')
      ORDER BY date ASC, start_time ASC
    `)
    .all();

  res.json({ reservations: rows });
});

app.post("/admin/reservations/:id/approve", requireAuth(JWT_SECRET), requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM reservations WHERE id=?").get(id);
  if (!row) return res.status(404).json({ error: "No existe" });
  if (row.status !== "active") return res.status(400).json({ error: "Reserva cancelada" });

  db.prepare(`
    UPDATE reservations
    SET payment_status='approved', payment_updated_at=datetime('now')
    WHERE id=?
  `).run(id);

  const updated = db.prepare("SELECT * FROM reservations WHERE id=?").get(id);
  res.json({ ok: true, reservation: updated });
});

app.post("/admin/reservations/:id/reject", requireAuth(JWT_SECRET), requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM reservations WHERE id=?").get(id);
  if (!row) return res.status(404).json({ error: "No existe" });
  if (row.status !== "active") return res.status(400).json({ error: "Reserva cancelada" });

  db.prepare(`
    UPDATE reservations
    SET payment_status='rejected', payment_updated_at=datetime('now')
    WHERE id=?
  `).run(id);

  const updated = db.prepare("SELECT * FROM reservations WHERE id=?").get(id);
  res.json({ ok: true, reservation: updated });
});

// =======================
// 💾 BACKUP DB (ADMIN)
// =======================
app.get("/admin/db/backup", requireAuth(JWT_SECRET), requireAdmin, (req, res) => {
  try {
    const backupsDir = process.env.BACKUPS_DIR || "./backups";
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupsDir, `ateneo-backup-${stamp}.db`);

    // copia simple
    fs.copyFileSync(DB_PATH, backupPath);

    res.json({ ok: true, backupPath });
  } catch (e) {
    console.error("❌ backup error:", e);
    res.status(500).json({ error: "No se pudo crear el backup" });
  }
});

// =======================
app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en http://localhost:${PORT}`);
});
