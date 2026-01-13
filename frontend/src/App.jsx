// Email: admin@ateneo.com
// Contraseña: Admin12345!

import React, { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from "react-router-dom";
import { api, logout } from "./api";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Calendar from "./pages/Calendar.jsx";
import MyReservations from "./pages/MyReservations.jsx";
import Admin from "./pages/Admin.jsx";
import Senia from "./pages/Senia.jsx";

// 🔐 NUEVO: reset password
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

function Layout({ user, setUser }) {
  const nav = useNavigate();

  return (
    <div className="container">
      {/* ===== TOPBAR CLÁSICO ===== */}
      <div className="topbar">
        <div className="brand">
          <div className="logo">AP</div>
          <div className="brand-title">
            <h1>ATENEO PADEL RESERVAS</h1>
            <p>2 canchas • reservas online</p>
          </div>
        </div>

        <div className="nav">
          <NavLink
            to="/calendario"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Calendario
          </NavLink>

          <NavLink
            to="/mis-reservas"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Mis reservas
          </NavLink>

          {user?.role === "admin" && (
            <NavLink
              to="/admin"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Admin
            </NavLink>
          )}

          <span className="badge">
            {user?.name} {user?.role === "admin" ? "🛡️" : ""}
          </span>

          <button
            className="btn btn-ghost"
            onClick={() => {
              logout();
              setUser(null);
              nav("/login");
            }}
          >
            Salir
          </button>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {/* ===== RUTAS INTERNAS (logueado) ===== */}
      <Routes>
        <Route path="/calendario" element={<Calendar user={user} />} />
        <Route path="/mis-reservas" element={<MyReservations user={user} />} />
        <Route path="/senia/:id" element={<Senia user={user} />} />

        <Route
          path="/admin"
          element={
            user?.role === "admin" ? <Admin /> : <Navigate to="/calendario" />
          }
        />

        <Route path="*" element={<Navigate to="/calendario" />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="container">
        <div className="card-solid card-body">Cargando...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ===== AUTH ===== */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/calendario" />
            ) : (
              <Login onLogged={(u) => setUser(u)} />
            )
          }
        />

        <Route
          path="/register"
          element={
            user ? (
              <Navigate to="/calendario" />
            ) : (
              <Register onLogged={(u) => setUser(u)} />
            )
          }
        />

        {/* 🔐 RESET PASSWORD (NO requiere login) */}
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/reset" element={<ResetPassword />} />

        {/* ===== APP LOGUEADA ===== */}
        <Route
          path="/*"
          element={
            user ? (
              <Layout user={user} setUser={setUser} />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
