const crypto = require('crypto');

const encryptionKey = crypto.randomBytes(32).toString('hex');
const chatKey = crypto.randomBytes(32).toString('hex');

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║         PRODUCTION ENCRYPTION KEYS GENERATED                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('Add these to your .env file:\n');
console.log(`ENCRYPTION_KEY=${encryptionKey}`);
console.log(`CHAT_ENCRYPTION_KEY=${chatKey}`);

console.log('\n📋 Store these keys securely in your secrets manager!\n');
