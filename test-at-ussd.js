const url = process.env.USSD_CALLBACK_URL || process.env.USSD_BASE_URL || (process.env.BACKEND_PUBLIC_URL ? `${process.env.BACKEND_PUBLIC_URL.replace(/\/+$/, '')}/api/ussd/process` : 'http://127.0.0.1:3001/api/ussd/process');
const phoneNumber = process.env.USSD_PHONE_NUMBER || '+27734801665';
const serviceCode = process.env.USSD_SERVICE_CODE || '*384*30933#';
const language = process.env.USSD_LANGUAGE || 'en';
const sessionId = process.env.USSD_SESSION_ID || `AT_SIM_${Date.now()}`;
const steps = process.argv.slice(2).map((step) => step.replace(/^(['"])(.*)\1$/, '$2'));
const flow = steps.length > 0 ? steps : ['', '1', '1*Test incident details'];

const run = async () => {
  console.log(`URL: ${url}`);
  console.log(`Session: ${sessionId}`);
  console.log(`Phone: ${phoneNumber}`);
  console.log(`Language: ${language}`);
  console.log(`Steps: ${flow.map((step) => JSON.stringify(step)).join(' -> ')}`);
  console.log('');

  for (const [index, step] of flow.entries()) {
    const payload = new URLSearchParams({
      phoneNumber,
      sessionId,
      serviceCode,
      text: step,
      language,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    });

    const body = await response.text();
    console.log(`Step ${index + 1}: ${JSON.stringify(step)}`);
    console.log(`Status: ${response.status}`);
    console.log(`Body: ${body}`);
    console.log('---');
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
