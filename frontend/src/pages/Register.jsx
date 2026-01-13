// frontend/src/pages/Register.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, setToken } from "../api";

export default function Register({ onLogged }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    if (name.trim().length < 2) return setErr("El nombre debe tener al menos 2 caracteres.");
    if (password.length < 8) return setErr("La contraseña debe tener mínimo 8 caracteres.");

    setLoading(true);
    try {
      const r = await api.register({ name: name.trim(), email: email.trim(), password });
      setToken(r.token);
      setOk("Cuenta creada correctamente. Entrando...");
      onLogged(r.user);
    } catch (e) {
      setErr(e.message || "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 460, margin: "48px auto" }}>
        <div className="card-body">
          <div className="badge" style={{ marginBottom: 10 }}>🧾 Registro</div>

          <h2 style={{ margin: "6px 0 6px 0" }}>Crear cuenta</h2>
          <p className="small" style={{ marginTop: 0 }}>
            Registrate para poder reservar turnos.
          </p>

          <form onSubmit={submit} className="grid" style={{ gap: 12, marginTop: 14 }}>
            <label>
              Nombre
              <input
                className="input"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>

            <label>
              Email
              <input
                className="input"
                placeholder="tuemail@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>

            <label>
              Contraseña
              <input
                className="input"
                placeholder="mínimo 8 caracteres"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>

            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear cuenta"}
            </button>

            {ok && <div className="success">{ok}</div>}
            {err && <div className="error">{err}</div>}
          </form>

          <hr />

          <p className="small" style={{ margin: 0 }}>
            ¿Ya tenés cuenta? <Link to="/login">Ingresar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
