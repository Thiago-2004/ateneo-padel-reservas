import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

const ALIAS = "ateneo.calzada";
const MONTO = 10000;
const WHATSAPP = "5491144142957"; // poné tu nro

export default function Senia({ user }) {
  const { id } = useParams();
  const nav = useNavigate();

  const [reserva, setReserva] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const statusLabel = useMemo(() => {
    const ps = reserva?.payment_status;
    if (!ps) return "Pendiente";
    if (ps === "pending") return "Pendiente";
    if (ps === "reported") return "Pago reportado (esperando aprobación)";
    if (ps === "approved") return "Confirmada ✅";
    if (ps === "rejected") return "Rechazada ❌";
    return ps;
  }, [reserva]);

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const r = await api.getReservationById(id);
      setReserva(r.reservation);
    } catch (e) {
      // 🔥 Clave: no bloqueamos la pantalla si falla el GET
      setErr(e.message || "No se pudo cargar la reserva, igual podés pagar la seña.");
      setReserva(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [id]);

  function abrirWhatsapp() {
    const msg = encodeURIComponent(
      `Hola! Hice una reserva (ID #${id}). Voy a transferir la seña de $${MONTO}.\nAlias: ${ALIAS}\nUsuario: ${user?.name} (${user?.email})`
    );
    window.open(`https://wa.me/${WHATSAPP}?text=${msg}`, "_blank");
  }

  async function yaTransferi() {
    setErr("");
    try {
      await api.reportPayment(id);
      alert("Listo! Queda como pago reportado. Un admin lo va a aprobar.");
      nav("/mis-reservas");
    } catch (e) {
      setErr(e.message || "No se pudo reportar el pago");
    }
  }

  async function copiarAlias() {
    try {
      await navigator.clipboard.writeText(ALIAS);
      alert("Alias copiado ✅");
    } catch {
      alert("No se pudo copiar, copialo manualmente.");
    }
  }

  return (
    <div className="card-solid">
      <div className="card-body" style={{ display: "grid", gap: 12 }}>
        <div className="badge">💳 Seña para confirmar</div>

        <h2 style={{ margin: 0 }}>Transferí $10.000 para confirmar</h2>
        <p className="small" style={{ marginTop: 0 }}>
          La reserva queda <b>PENDIENTE</b> hasta que un administrador apruebe el pago.
        </p>

        <div className="card" style={{ padding: 14 }}>
          <div className="small">Alias</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{ALIAS}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={copiarAlias}>Copiar alias</button>
            <button className="btn btn-ghost" onClick={abrirWhatsapp}>Abrir WhatsApp</button>
          </div>

          <div className="small" style={{ marginTop: 10 }}>Monto</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>${MONTO.toLocaleString("es-AR")}</div>
        </div>

        <div className="item item-top">
          <div className="stack">
            <div className="item-title">Reserva #{id}</div>
            <div className="item-sub">Estado: <b>{loading ? "Cargando..." : statusLabel}</b></div>

            {reserva && (
              <div className="small">
                {reserva.date} {reserva.start_time} • Cancha {reserva.court} • {reserva.duration_min} min
              </div>
            )}
          </div>
        </div>

        {err && <div className="alert error">{err}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => nav("/calendario")}>Volver</button>
          <button className="btn btn-primary" onClick={yaTransferi}>Ya transferí</button>
        </div>
      </div>
    </div>
  );
}
