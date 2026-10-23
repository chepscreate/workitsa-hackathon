const Q = require('qrcode');
Q.toString('https://workitsa.co.za', {
  type: 'svg', margin: 0, errorCorrectionLevel: 'M',
  color: { dark: '#1F1710', light: '#ffffff' },
}).then(function (s) {
  require('fs').writeFileSync(__dirname + '/qr.svg', s);
  console.log('OK len=' + s.length);
}).catch(function (e) { console.error('ERR', e.message); process.exit(1); });
