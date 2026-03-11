const url = 'http://localhost:3001/api/ussd/process';
const payload = new URLSearchParams({
  phoneNumber: '+27734801665',
  sessionId: 'AT_ELEVATE_TEST_2',
  serviceCode: '*384*54987#',
  text: '',
  language: 've'
});

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: payload.toString()
})
  .then(async res => {
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  })
  .catch(err => console.error(err));