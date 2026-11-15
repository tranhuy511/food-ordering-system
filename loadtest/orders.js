
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8081').replace(/\/$/, '');
const LOGIN_PATH = __ENV.LOGIN_PATH || '/auth/login';
const ORDERS_PATH = __ENV.ORDERS_PATH || '/orders';
const LOGIN_IDENTIFIER_FIELD = __ENV.LOGIN_IDENTIFIER_FIELD || 'email';
const LOGIN_IDENTIFIER = __ENV.LOGIN_IDENTIFIER || 'test@example.com';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD || 'REPLACE_WITH_TEST_PASSWORD';

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || '60s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  const payload = {
    [LOGIN_IDENTIFIER_FIELD]: LOGIN_IDENTIFIER,
    password: LOGIN_PASSWORD,
  };

  const res = http.post(
    `${BASE_URL}${LOGIN_PATH}`,
    JSON.stringify(payload),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST login' },
    }
  );

  if (!check(res, {
    'Login successful': (r) =>
      r.status === 200 || r.status === 201,
  })) {
    throw new Error(`Login failed: ${res.status} - ${res.body}`);
  }

  const body = res.json();

  const token =
    body.accessToken ||
    body.access_token ||
    body.token ||
    body.data?.accessToken ||
    body.data?.access_token ||
    body.data?.token ||
    body.result?.accessToken ||
    body.result?.token;

  if (!token) {
    throw new Error('Cannot find access token in login response');
  }

  return { token };
}

export default function (data) {
  const res = http.get(
    `${BASE_URL}${ORDERS_PATH}`,
    {
      headers: {
        Authorization: `Bearer ${data.token}`,
        Accept: 'application/json',
      },
      tags: { name: 'GET orders' },
    }
  );

  check(res, {
    'GET orders successful': (r) => r.status === 200,
  });

  sleep(1);
}
