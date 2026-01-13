// frontend/src/pages/Calendar.jsx
import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { api } from "../api";
import "./Calendar.css";

// helpers
const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};
const hm = (d) => {
  const dt = new Date(d);
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
};
const addMinutes = (dateObj, mins) => {
  const d = new Date(dateObj);
  d.setMinutes(d.getMinutes() + mins);
  return d;
};

export default function Calendar({ user }) {
  const nav = useNavigate();

  const cal1Ref = useRef(null);
  const cal2Ref = useRef(null);

  const [view, setView] = useState("timeGridWeek");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [reservations, setReservations] = useState([]);

  // modal create
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    date: ymd(new Date()),
    start_time: "19:00",
    duration_min: 60,
    court: 1,
  });

  // modal details
  const [selected, setSelected] = useState(null);

  async function loadForRange(dateFrom, dateTo) {
    setErr("");
    setLoading(true);
    try {
      const r = await api.reservations(`?dateFrom=${dateFrom}&dateTo=${dateTo}`);
      setReservations(r.reservations || []);
    } catch (e) {
      setErr(e.message || "Error cargando reservas");
    } finally {
      setLoading(false);
    }
  }

  function syncTo(date) {
    const a = cal1Ref.current?.getApi();
    const b = cal2Ref.current?.getApi();
    if (!a || !b) return;
    a.gotoDate(date);
    b.gotoDate(date);
  }

  async function refreshCurrentRange() {
    const a = cal1Ref.current?.getApi();
    if (!a) return;
    const start = ymd(a.view.activeStart);
    const end = ymd(addMinutes(a.view.activeEnd, -1));
    await loadForRange(start, end);
  }

  function handleDatesSet(arg) {
    const start = ymd(arg.start);
    const end = ymd(addMinutes(arg.end, -1));
    loadForRange(start, end);
  }

  const active = useMemo(
    () => reservations.filter((r) => r.status === "active"),
    [reservations]
  );

  const eventsCourt1 = useMemo(() => {
    return active
      .filter((r) => Number(r.court) === 1)
      .map((r) => {
        const start = new Date(`${r.date}T${r.start_time}:00`);
        const end = addMinutes(start, Number(r.duration_min));
        return {
          id: String(r.id),
          title: `${r.user_name}`,
          start,
          end,
          extendedProps: { row: r },
          backgroundColor: "rgba(42,167,255,.22)",
          borderColor: "rgba(42,167,255,.55)",
          textColor: "#0b1220",
        };
      });
  }, [active]);

  const eventsCourt2 = useMemo(() => {
    return active
      .filter((r) => Number(r.court) === 2)
      .map((r) => {
        const start = new Date(`${r.date}T${r.start_time}:00`);
        const end = addMinutes(start, Number(r.duration_min));
        return {
          id: String(r.id),
          title: `${r.user_name}`,
          start,
          end,
          extendedProps: { row: r },
          backgroundColor: "rgba(27,134,214,.22)",
          borderColor: "rgba(27,134,214,.55)",
          textColor: "#0b1220",
        };
      });
  }, [active]);

  function openCreate(dateObj, court) {
    setForm((f) => ({
      ...f,
      date: ymd(dateObj),
      start_time: hm(dateObj),
      court,
    }));
    setCreateOpen(true);
  }

  function handleDateClick(court) {
    return (info) => openCreate(info.date, court);
  }

  function handleSelect(court) {
    return (info) => {
      const mins = Math.max(30, Math.round((info.end - info.start) / 60000));
      const options = [60, 90, 120];
      const best = options.reduce(
        (a, b) => (Math.abs(b - mins) < Math.abs(a - mins) ? b : a),
        60
      );

      setForm((f) => ({
        ...f,
        date: ymd(info.start),
        start_time: hm(info.start),
        duration_min: best,
        court,
      }));
      setCreateOpen(true);
    };
  }

  function handleEventClick(info) {
    setSelected(info.event.extendedProps.row);
  }

  // ✅ CAMBIO CLAVE: al crear -> redirige a /senia/:id
  async function createReservation() {
    setErr("");
    try {
      const r = await api.createReservation({
        court: Number(form.court),
        date: form.date,
        start_time: form.start_time,
        duration_min: Number(form.duration_min),
      });

      setCreateOpen(false);

      // El backend devuelve { reservationId, deposit_amount, payment_status, ... }
      const reservationId = r?.reservationId || r?.reservation?.id;

      if (reservationId) {
        nav(`/senia/${reservationId}`);
        return;
      }

      // fallback si por alguna razón no viene el id
      await refreshCurrentRange();
    } catch (e) {
      setErr(e.message || "No se pudo crear la reserva");
    }
  }

  const canCancelSelected = useMemo(() => {
    if (!selected) return false;
    const isOwner = selected.user_id === user.id;
    const isAdmin = user.role === "admin";
    return selected.status === "active" && (isOwner || isAdmin);
  }, [selected, user]);

  async function cancelSelected() {
    if (!selected) return;
    const ok = window.confirm("¿Cancelar esta reserva?");
    if (!ok) return;

    setErr("");
    try {
      await api.cancelReservation(selected.id);
      setSelected(null);
      await refreshCurrentRange();
    } catch (e) {
      setErr(e.message || "No se pudo cancelar");
    }
  }

  function prev() {
    const a = cal1Ref.current?.getApi();
    if (!a) return;
    a.prev();
    syncTo(a.getDate());
  }
  function next() {
    const a = cal1Ref.current?.getApi();
    if (!a) return;
    a.next();
    syncTo(a.getDate());
  }
  function today() {
    syncTo(new Date());
  }
  function setCalendarView(v) {
    setView(v);
    const a = cal1Ref.current?.getApi();
    const b = cal2Ref.current?.getApi();
    if (a) a.changeView(v);
    if (b) b.changeView(v);
  }

  const commonProps = {
    plugins: [timeGridPlugin, dayGridPlugin, interactionPlugin],
    locale: "es",
    allDaySlot: false,
    nowIndicator: true,
    selectable: true,
    selectMirror: true,
    height: "auto",
    slotMinTime: "08:00:00",
    slotMaxTime: "24:00:00",
    eventClick: handleEventClick,
  };

  return (
    <div className="calendar-wrap">
      <div className="card">
        <div className="card-body calendar-toolbar">
          <div className="calendar-left">
            <span className="badge">🎾 Canchas (vista doble)</span>
            <span className="small">
              {loading ? "Cargando..." : "Cancha 1 y Cancha 2 lado a lado"}
            </span>
          </div>

          <div className="calendar-right">
            <div className="calendar-controls">
              <button className="btn btn-ghost" onClick={prev}>◀</button>
              <button className="btn btn-ghost" onClick={today}>Hoy</button>
              <button className="btn btn-ghost" onClick={next}>▶</button>

              <button
                className={`btn ${view === "timeGridDay" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCalendarView("timeGridDay")}
              >
                Día
              </button>
              <button
                className={`btn ${view === "timeGridWeek" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCalendarView("timeGridWeek")}
              >
                Semana
              </button>
              <button
                className={`btn ${view === "dayGridMonth" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCalendarView("dayGridMonth")}
              >
                Mes
              </button>

              <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                + Nueva reserva
              </button>
            </div>
          </div>
        </div>
      </div>

      {err && <div className="alert error">{err}</div>}

      <div className="two-cal">
        {/* Cancha 1 */}
        <div className="card-solid">
          <div className="card-body">
            <div className="court-head">
              <div className="badge">Cancha 1</div>
              <span className="small">Click para crear • Click en bloque para ver</span>
            </div>

            <FullCalendar
              ref={cal1Ref}
              {...commonProps}
              initialView={view}
              datesSet={handleDatesSet}
              dateClick={handleDateClick(1)}
              select={handleSelect(1)}
              events={eventsCourt1}
              initialDate={new Date()}
              viewDidMount={refreshCurrentRange}
            />
          </div>
        </div>

        {/* Cancha 2 */}
        <div className="card-solid">
          <div className="card-body">
            <div className="court-head">
              <div className="badge">Cancha 2</div>
              <span className="small">Click para crear • Click en bloque para ver</span>
            </div>

            <FullCalendar
              ref={cal2Ref}
              {...commonProps}
              initialView={view}
              // NO datesSet acá para evitar doble fetch
              dateClick={handleDateClick(2)}
              select={handleSelect(2)}
              events={eventsCourt2}
              initialDate={new Date()}
            />
          </div>
        </div>
      </div>

      {/* MODAL CREAR */}
      {createOpen && (
        <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="card-solid modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-body modal-grid">
              <div className="modal-head">
                <div className="modal-head-left">
                  <div className="badge">🎾 Nueva reserva</div>
                  <div className="small">
                    Se guarda como <b>{user.name}</b> {user.role === "admin" ? "(admin)" : ""}
                  </div>
                  <div className="small">
                    Se solicita seña: <b>$10.000</b> (queda pendiente hasta aprobación).
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
                  Cerrar
                </button>
              </div>

              <label>
                Fecha
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>

              <div className="modal-row-2">
                <label>
                  Hora
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </label>
                <label>
                  Duración
                  <select
                    value={form.duration_min}
                    onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })}
                  >
                    <option value={60}>1 hora</option>
                    <option value={90}>1 hora 30</option>
                    <option value={120}>2 horas</option>
                  </select>
                </label>
              </div>

              <label>
                Cancha
                <select
                  value={form.court}
                  onChange={(e) => setForm({ ...form, court: Number(e.target.value) })}
                >
                  <option value={1}>Cancha 1</option>
                  <option value={2}>Cancha 2</option>
                </select>
              </label>

              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={createReservation}>
                  Reservar y pagar seña
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE */}
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="card-solid modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="card-body modal-grid">
              <div className="modal-head">
                <div className="badge">📌 Detalle reserva</div>
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>
                  Cerrar
                </button>
              </div>

              <div className="item item-top">
                <div className="stack">
                  <div className="item-title">
                    {selected.date} {selected.start_time} • Cancha {selected.court} • {selected.duration_min} min
                  </div>
                  <div className="item-sub">
                    Reservó: <b>{selected.user_name}</b> — {selected.user_email}
                  </div>
                  <div className="small">
                    Estado: {selected.status}
                    {selected.payment_status ? ` • Pago: ${selected.payment_status}` : ""}
                  </div>
                </div>
                <span className="badge">ID #{selected.id}</span>
              </div>

              <div className="modal-actions">
                {canCancelSelected ? (
                  <button className="btn btn-danger" onClick={cancelSelected}>
                    Cancelar reserva
                  </button>
                ) : (
                  <span className="small">Solo puede cancelar el dueño o un admin.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
