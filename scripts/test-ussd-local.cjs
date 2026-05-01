#!/usr/bin/env node
/**
 * Local USSD smoke test — POSTs to /api/ussd/test (requires dev server).
 *
 * Usage:
 *   npm run ussd:local
 *   npm run ussd:local -- +27821234567 ""
 *   npm run ussd:local -- +27821234567 "1"
 *
 * Env:
 *   AEGIS_USSD_TEST_URL  (default http://127.0.0.1:3000/api/ussd/test)
 *   AEGIS_USSD_LANG      (default en)
 */

const url = process.env.AEGIS_USSD_TEST_URL || 'http://127.0.0.1:3000/api/ussd/test';
const phone = process.argv[2] || '+27821234567';
const userInput = process.argv[3] ?? '';
const language = process.env.AEGIS_USSD_LANG || 'en';

const body = JSON.stringify({ phoneNumber: phone, userInput, language });

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body,
})
  .then(async (r) => {
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch {
      console.error('Non-JSON response', r.status, text.slice(0, 500));
      process.exit(1);
    }
  })
  .then((data) => {
    console.log(JSON.stringify(data, null, 2));
    if (data && data.success === false) process.exit(1);
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
