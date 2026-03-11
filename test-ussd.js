const url = 'http://localhost:3001/api/ussd/telkom/callback';
const payload = {
  subscriber: '27831234567',
  input: '',
  sessionId: 'test-session-1',
  language: 'en'
};

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
  .then(res => res.json())
  .then(data => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => console.error(err));