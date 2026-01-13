// frontend/src/pages/MyReservations.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

function paymentLabel(ps) {
  if (!ps) return "Pendiente (sin estado)";
  if (ps === "pending") return "Pendiente (falta seña)";
  if (ps === "reported") return "Pago reportado (esperando aprobación)";
  if (ps === "approved") return "Confirmada ✅";
  if (ps === "rejected") return "Rechazada ❌";
  return ps;
}

export default function MyReservations({ user }) {
  const nav = useNavigate();

  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await api.reservations("");

      // ✅ SOLO ACTivas (así no te queda largo con canceladas)
      const mineActive = (r.reservations || [])
        .filter((x) => x.user_id === user.id && x.status === "active")
        .slice(0, 100);

      setRows(mineActive);
    } catch (e) {
      setErr(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  async function cancel(id) {
    const ok = window.confirm("¿Cancelar esta reserva?");
    if (!ok) return;

    setErr("");
    try {
      await api.cancelReservation(id);
      await load();
    } catch (e) {
      setErr(e.message || "No se pudo cancelar");
    }
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const A = `${a.date}T${a.start_time}`;
      const B = `${b.date}T${b.start_time}`;
      return A.localeCompare(B);
    });
  }, [rows]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>Mis reservas</h2>
        <button className="btn btn-ghost" onClick={load}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {err && (
        <div className="alert error" style={{ marginTop: 10 }}>
          {err}
        </div>
      )}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {sorted.length === 0 ? (
          <div className="card-solid card-body">No tenés reservas activas.</div>
        ) : (
          sorted.map((r) => {
            // ✅ ahora también cuenta null/undefined como "pendiente"
            const needsDeposit =
              r.status === "active" &&
              (r.payment_status === "pending" ||
                r.payment_status === "reported" ||
                r.payment_status === null ||
                r.payment_status === undefined ||
                r.payment_status === "");

            return (
              <div key={r.id} className="card-solid">
                <div className="card-body" style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 800 }}>
                      {r.date} {r.start_time} • Cancha {r.court} • {r.duration_min} min
                    </div>
                    <span className="badge">ID #{r.id}</span>
                  </div>

                  <div className="small" style={{ opacity: 0.9 }}>
                    Estado reserva: <b>{r.status}</b>
                    {"  •  "}
                    Estado pago: <b>{paymentLabel(r.payment_status)}</b>
                  </div>

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {needsDeposit && (
                      <button className="btn btn-primary" onClick={() => nav(`/senia/${r.id}`)}>
                        Pagar seña
                      </button>
                    )}

                    {r.status === "active" && (
                      <button className="btn btn-danger" onClick={() => cancel(r.id)}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ✅ Debug visual (lo podés borrar después) */}
      <div className="small" style={{ opacity: 0.6, marginTop: 16 }}>
        Tip: Si no aparece “Pagar seña”, revisá que el backend esté devolviendo payment_status en /reservations.
      </div>
    </div>
  );
}
