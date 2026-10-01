const { OAuth2Client } = require('google-auth-library');

function json(res, status, body) {
  res.status(status).json(body);
}

function readBearerToken(req) {
  const authorization = req.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

async function verifyGoogleIdToken(req) {
  const token = readBearerToken(req);
  if (!token) {
    const error = new Error('Credencial do Google ausente. Faça login novamente.');
    error.statusCode = 401;
    throw error;
  }

  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId) {
    const error = new Error('GOOGLE_CLIENT_ID não está configurado no servidor.');
    error.statusCode = 500;
    throw error;
  }

  const client = new OAuth2Client(clientId);
  let ticket;

  try {
    ticket = await client.verifyIdToken({
      idToken: token,
      audience: clientId
    });
  } catch (cause) {
    const error = new Error('Token do Google inválido ou expirado. Faça login novamente.');
    error.statusCode = 401;
    error.cause = cause;
    throw error;
  }

  const payload = ticket.getPayload();

  if (!payload || !payload.sub) {
    const error = new Error('O Google não retornou um identificador de usuário válido.');
    error.statusCode = 401;
    throw error;
  }

  if (payload.email_verified !== true) {
    const error = new Error('A conta Google precisa ter o e-mail verificado.');
    error.statusCode = 403;
    throw error;
  }

  return payload;
}

async function requireAdmin(req) {
  const payload = await verifyGoogleIdToken(req);

  const configuredSub = (process.env.ADMIN_GOOGLE_SUB || '').trim();
  const configuredEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const payloadEmail = (payload.email || '').trim().toLowerCase();

  if (!configuredSub && !configuredEmail) {
    const error = new Error('Nenhum administrador foi configurado. Defina ADMIN_EMAIL e, depois, ADMIN_GOOGLE_SUB no Vercel.');
    error.statusCode = 500;
    throw error;
  }

  // Modo estrito: se o SUB existe, ele é obrigatório.
  if (configuredSub && payload.sub !== configuredSub) {
    const error = new Error('Conta Google não autorizada para administrar o WebCore.');
    error.statusCode = 403;
    throw error;
  }

  // Se também houver e-mail configurado, usamos como segunda conferência.
  if (configuredEmail && payloadEmail !== configuredEmail) {
    const error = new Error('Conta Google não autorizada para administrar o WebCore.');
    error.statusCode = 403;
    throw error;
  }

  return {
    payload,
    bootstrap: !configuredSub
  };
}

module.exports = {
  json,
  requireAdmin
};
