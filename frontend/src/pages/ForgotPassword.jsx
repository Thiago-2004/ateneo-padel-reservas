// frontend/src/pages/ForgotPassword.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setOk(false);
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      await api.forgotPassword(cleanEmail);
      setOk(true);
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 460, margin: "48px auto" }}>
        <div className="card-body">
          <div className="badge" style={{ marginBottom: 10 }}>🔐 Reset</div>

          <h2 style={{ margin: "6px 0" }}>Recuperar contraseña</h2>
          <p className="small" style={{ marginTop: 0 }}>
            Te mandamos un link a tu email (expira en 15 minutos).
          </p>

          <form onSubmit={submit} className="grid" style={{ gap: 12, marginTop: 14 }}>
            <label>
              Email
              <input
                className="input"
                placeholder="tuemail@gmail.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link"}
            </button>

            {err && <div className="error">{err}</div>}

            {ok && (
              <div className="alert success">
                ✅ Si el email existe, te enviamos el link de recuperación.
              </div>
            )}
          </form>

          <hr />

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <p className="small" style={{ margin: 0 }}>
              <Link to="/login">Volver al login</Link>
            </p>

            <p className="small" style={{ margin: 0, opacity: 0.85 }}>
              ¿Ya tenés el token? <Link to="/reset">Cambiar contraseña</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
