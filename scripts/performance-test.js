import http from 'k6/http';
import { check, group, sleep } from 'k6';

const API_URL = __ENV.API_URL || 'http://localhost:3000';

export let options = {
  vus: parseInt(__ENV.K6_VUS || 10),
  duration: __ENV.K6_DURATION || '1m',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  group('Health Check', () => {
    let res = http.get(`${API_URL}/health/ready`);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
  });

  group('API Endpoints', () => {
    // Test health endpoint
    let healthRes = http.get(`${API_URL}/api/health`);
    check(healthRes, {
      'health status is 200': (r) => r.status === 200,
      'health response time < 200ms': (r) => r.timings.duration < 200,
    });

    // Test USSD endpoint
    let ussdRes = http.post(`${API_URL}/api/ussd/test`, JSON.stringify({
      phoneNumber: '+27123456789',
      userInput: 'test',
      language: 'en',
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    check(ussdRes, {
      'USSD response status': (r) => r.status === 200 || r.status === 400,
      'USSD response time < 1000ms': (r) => r.timings.duration < 1000,
    });
  });

  group('Metrics Endpoint', () => {
    let metricsRes = http.get(`${API_URL}/metrics`);
    check(metricsRes, {
      'metrics status is 200': (r) => r.status === 200,
      'metrics contains prometheus format': (r) => r.body.includes('http_request_duration_ms'),
    });
  });

  group('Error Handling', () => {
    // Test 404
    let notFoundRes = http.get(`${API_URL}/api/nonexistent`);
    check(notFoundRes, {
      '404 status is correct': (r) => r.status === 404,
    });

    // Test invalid request
    let invalidRes = http.post(`${API_URL}/api/auth/verify`, JSON.stringify({
      invalid: 'data',
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    check(invalidRes, {
      'invalid request returns error': (r) => r.status >= 400,
    });
  });

  sleep(1);
}
