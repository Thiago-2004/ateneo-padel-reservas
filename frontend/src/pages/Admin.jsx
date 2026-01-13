import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function Admin() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await api.adminPendingReservations();
      setRows(r.reservations || []);
    } catch (e) {
      setErr(e.message || "Error cargando pendientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(id) {
    const ok = window.confirm("¿Aprobar pago y confirmar reserva?");
    if (!ok) return;
    setErr("");
    try {
      await api.adminApproveReservation(id);
      await load();
    } catch (e) {
      setErr(e.message || "No se pudo aprobar");
    }
  }

  async function reject(id) {
    const ok = window.confirm("¿Rechazar pago? (la reserva quedará rechazada)");
    if (!ok) return;
    setErr("");
    try {
      await api.adminRejectReservation(id);
      await load();
    } catch (e) {
      setErr(e.message || "No se pudo rechazar");
    }
  }

  return (
    <div className="card-solid">
      <div className="card-body">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>Admin • Pagos pendientes</h2>
            <div className="small" style={{ marginTop: 6 }}>
              Acá confirmás reservas de usuarios (pending / reported)
            </div>
          </div>

          <button className="btn btn-ghost" onClick={load}>
            ↻ Actualizar
          </button>
        </div>

        <div style={{ height: 14 }} />

        {err && <div className="alert error">{err}</div>}
        {loading ? (
          <div className="small">Cargando...</div>
        ) : rows.length === 0 ? (
          <div className="small">No hay pagos pendientes ✅</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <div key={r.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>
                      {r.date} {r.start_time} • Cancha {r.court} • {r.duration_min} min
                    </div>
                    <div className="small" style={{ marginTop: 4 }}>
                      Usuario: <b>{r.user_name}</b> — {r.user_email}
                    </div>
                    <div className="small" style={{ marginTop: 4 }}>
                      Pago: <b>{r.payment_status}</b> • Seña: <b>${r.deposit_amount}</b>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button className="btn btn-primary" onClick={() => approve(r.id)}>
                      Aprobar
                    </button>
                    <button className="btn btn-danger" onClick={() => reject(r.id)}>
                      Rechazar
                    </button>
                  </div>
                </div>

                <div className="small" style={{ marginTop: 8, opacity: 0.75 }}>
                  ID #{r.id} • actualizado: {r.payment_updated_at || "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
