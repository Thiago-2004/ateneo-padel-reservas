// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, setToken } from "../api";

export default function Login({ onLogged }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      const r = await api.login({ email: cleanEmail, password });
      setToken(r.token);
      onLogged(r.user);
    } catch (e) {
      setErr(e.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 460, margin: "48px auto" }}>
        <div className="card-body">
          <div className="badge" style={{ marginBottom: 10 }}>
            🎾 ATENEO
          </div>

          <h2 style={{ margin: "6px 0 6px 0" }}>Ingresar</h2>
          <p className="small" style={{ marginTop: 0 }}>
            Entrá para reservar Cancha 1 o Cancha 2.
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

            <label>
              Contraseña
              <input
                className="input"
                placeholder="********"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Ingresando..." : "Entrar"}
            </button>

            {err && <div className="error">{err}</div>}
          </form>

          {/* 🔑 Recuperar contraseña */}
          <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
            <p className="small" style={{ margin: 0 }}>
              <Link to="/forgot">¿Olvidaste tu contraseña?</Link>
            </p>

            <p className="small" style={{ margin: 0, opacity: 0.85 }}>
              ¿Ya tenés el token? <Link to="/reset">Cambiar contraseña</Link>
            </p>
          </div>

          <hr />

          <p className="small" style={{ margin: 0 }}>
            ¿No tenés cuenta? <Link to="/register">Registrate</Link>
          </p>

          <p className="small" style={{ margin: "10px 0 0 0" }}>
            Tip: si sos admin, al entrar vas a ver la sección <b>Admin</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
