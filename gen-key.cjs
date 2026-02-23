const crypto = require('crypto');
console.log('ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'));
