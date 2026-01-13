// frontend/src/pages/ResetPassword.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function ResetPassword() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const tokenFromUrl = useMemo(() => sp.get("token") || "", [sp]);

  const [token, setToken] = useState(tokenFromUrl);
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(tokenFromUrl);
  }, [tokenFromUrl]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setOk(false);

    const cleanToken = (token || "").trim();

    if (!cleanToken) return setErr("Falta token");
    if (pass1.length < 8) return setErr("La contraseña debe tener al menos 8 caracteres");
    if (pass1 !== pass2) return setErr("Las contraseñas no coinciden");

    setLoading(true);
    try {
      // ✅ coincide con tu api.js (objeto)
      await api.resetPassword({ token: cleanToken, newPassword: pass1 });

      setOk(true);
      setTimeout(() => nav("/login"), 900);
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
          <h2 style={{ margin: "6px 0" }}>Nueva contraseña</h2>

          <form onSubmit={submit} className="grid" style={{ gap: 12, marginTop: 14 }}>
            <label>
              Token
              <input
                className="input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Pegá el token acá"
                autoComplete="off"
                required
              />
            </label>

            <label>
              Nueva contraseña
              <input
                className="input"
                type="password"
                value={pass1}
                onChange={(e) => setPass1(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            <label>
              Repetir contraseña
              <input
                className="input"
                type="password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </button>

            {err && <div className="error">{err}</div>}
            {ok && <div className="alert success">✅ Contraseña cambiada. Redirigiendo…</div>}
          </form>

          <hr />
          <p className="small" style={{ margin: 0 }}>
            <Link to="/login">Volver al login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
