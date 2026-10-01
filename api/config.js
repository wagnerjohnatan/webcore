module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');

  return res.status(200).json({
    googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    donationUrl: (process.env.DONATION_URL || '').trim(),
    geminiModel: (process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim(),
    geminiGoogleSearch: String(process.env.GEMINI_USE_GOOGLE_SEARCH || 'false').toLowerCase() === 'true'
  });
};
