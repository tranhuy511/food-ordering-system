const TOKEN_KEY = 'foodie_access_token';
const USER_KEY = 'foodie_user';

export const authStore = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  },
  save: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = authStore.token();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(path, { ...options, headers });
  } catch {
    throw new Error('Không thể kết nối API Gateway. Hãy kiểm tra Nginx và các service backend.');
  }

  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; }
  catch { data = raw; }

  if (!response.ok) {
    const message = data?.message;
    throw new Error(Array.isArray(message) ? message.join(', ') : message || `Yêu cầu thất bại (${response.status})`);
  }
  return data;
}

export const money = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(Number(value || 0));

export const dateTime = (value) => value
  ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';
