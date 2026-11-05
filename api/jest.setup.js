require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
process.env.APP_ENC_KEY = process.env.APP_ENC_KEY || 'test-key';
process.env.GEOCODE_WORKER = 'off';
process.env.RATE_LIMIT = 'off';
