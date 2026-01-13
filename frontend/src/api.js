// frontend/src/api.js
const API_URL = "http://localhost:4001";

export function setToken(token) {
  localStorage.setItem("token", token);
}
export function getToken() {
  return localStorage.getItem("token");
}
export function logout() {
  localStorage.removeItem("token");
}

async function request(path, { method = "GET", body } = {}) {
  const token = getToken();

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg =
      (typeof data?.error === "string" && data.error) ||
      data?.error?.message ||
      data?.message ||
      "Error";
    throw new Error(msg);
  }

  return data;
}

export const api = {
  // AUTH
  register: (payload) => request("/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),
  me: () => request("/me"),

  // RESET PASSWORD ✅ (coincide con backend)
  forgotPassword: (email) => request("/auth/forgot", { method: "POST", body: { email } }),
  resetPassword: ({ token, newPassword }) =>
    request("/auth/reset", { method: "POST", body: { token, newPassword } }),

  // RESERVAS
  reservations: (q = "") => request(`/reservations${q}`),
  getReservationById: (id) => request(`/reservations/${id}`),

  createReservation: (payload) => request("/reservations", { method: "POST", body: payload }),
  cancelReservation: (id) => request(`/reservations/${id}`, { method: "DELETE" }),
  updateReservation: (id, payload) => request(`/reservations/${id}`, { method: "PATCH", body: payload }),

  // SEÑA / PAGO
  reportPayment: (id) => request(`/reservations/${id}/report-payment`, { method: "POST" }),

  // ADMIN - usuarios
  users: () => request("/users"),
  promote: (userId) => request("/users/promote", { method: "POST", body: { userId } }),

  // ADMIN - pagos
  adminApproveReservation: (id) => request(`/admin/reservations/${id}/approve`, { method: "POST" }),
  adminRejectReservation: (id) => request(`/admin/reservations/${id}/reject`, { method: "POST" }),

  // (opcional) ADMIN - lista pendientes (si después lo usás en Admin.jsx)
  adminPendingReservations: () => request(`/admin/reservations/pending`),
};
