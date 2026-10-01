module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  return res.status(200).json({
    ok: true,
    app: 'WebCore 1.0',
    timestamp: new Date().toISOString()
  });
};
