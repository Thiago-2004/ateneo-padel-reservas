import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export function signToken(user, secret) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    secret,
    { expiresIn: "7d" }
  );
}

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
