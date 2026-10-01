const { requireAdmin } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    const { payload, bootstrap } = await requireAdmin(req);

    return res.status(200).json({
      authorized: true,
      bootstrap,
      sub: payload.sub,
      email: payload.email || '',
      name: payload.name || '',
      picture: payload.picture || ''
    });
  } catch (error) {
    console.error('admin-auth:', error.cause || error);
    return res.status(error.statusCode || 500).json({
      authorized: false,
      error: error.message || 'Falha ao validar a conta administrativa.'
    });
  }
};
