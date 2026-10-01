const { requireAdmin } = require('../lib/auth');

function normalizeCatalog(catalog) {
  if (!Array.isArray(catalog)) return [];
  return catalog.slice(0, 120).map((item) => ({
    id: String(item?.id || '').slice(0, 80),
    name: String(item?.name || '').slice(0, 120),
    category: String(item?.category || '').slice(0, 80),
    layers: Array.isArray(item?.layers) ? item.layers.slice(0, 5).map(String) : [],
    fullStack: Boolean(item?.fullStack),
    difficulty: Number(item?.difficulty || 0),
    desc: String(item?.desc || '').slice(0, 300),
    ecosystem: String(item?.ecosystem || '').slice(0, 80)
  }));
}

function extractInteractionAnswer(data) {
  const texts = [];
  const citations = [];

  for (const step of data?.steps || []) {
    if (step?.type !== 'model_output') continue;

    for (const block of step?.content || []) {
      if (block?.type !== 'text') continue;

      if (block.text) texts.push(block.text);

      for (const annotation of block.annotations || []) {
        if (annotation?.type === 'url_citation' && annotation.url) {
          citations.push({
            title: annotation.title || annotation.url,
            url: annotation.url
          });
        }
      }
    }
  }

  const uniqueCitations = [];
  const seen = new Set();

  for (const citation of citations) {
    if (seen.has(citation.url)) continue;
    seen.add(citation.url);
    uniqueCitations.push(citation);
  }

  return {
    analysis: texts.join('\n\n').trim(),
    citations: uniqueCitations.slice(0, 20)
  };
}

function extractGenerateContentAnswer(data) {
  const texts = [];

  for (const candidate of data?.candidates || []) {
    for (const part of candidate?.content?.parts || []) {
      if (part?.text) texts.push(part.text);
    }
  }

  return {
    analysis: texts.join('\n\n').trim(),
    citations: []
  };
}

async function callGemini({ apiKey, model, prompt, useGoogleSearch }) {
  if (useGoogleSearch) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        model,
        input: prompt,
        tools: [{ type: 'google_search' }]
      })
    });

    const data = await response.json();
    return { response, data, result: extractInteractionAnswer(data) };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      })
    }
  );

  const data = await response.json();
  return { response, data, result: extractGenerateContentAnswer(data) };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    await requireAdmin(req);

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY não está configurada no Vercel.'
      });
    }

    const catalog = normalizeCatalog(req.body?.catalog);
    if (!catalog.length) {
      return res.status(400).json({
        error: 'O catálogo enviado está vazio ou inválido.'
      });
    }

    const model = (process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
    const useGoogleSearch = String(process.env.GEMINI_USE_GOOGLE_SEARCH || 'false').toLowerCase() === 'true';

    const prompt = `
Você está atuando como revisor técnico do WebCore 1.0, uma ferramenta educacional para alunos iniciantes escolherem tecnologias para frontend, backend e banco de dados.

${useGoogleSearch
  ? 'Use Pesquisa Google quando necessário e priorize fontes oficiais das tecnologias.'
  : 'Não afirme que consultou informações em tempo real. Quando uma informação puder depender de atualização recente, sinalize que ela precisa de verificação manual.'}

Analise APENAS o catálogo enviado abaixo e produza um relatório de manutenção. Não altere o código automaticamente.

Objetivos:
1. Identificar tecnologias do catálogo que estejam obsoletas, renomeadas, descontinuadas ou com descrição materialmente desatualizada.
2. Identificar possíveis mudanças relevantes de compatibilidade entre tecnologias do catálogo.
3. Sugerir novas tecnologias somente quando fizer sentido em um catálogo educacional para iniciantes.
4. Separar claramente: "Manter", "Atualizar", "Avaliar inclusão" e "Avaliar remoção".
5. Para cada mudança proposta, explicar o motivo em linguagem objetiva e indicar o nível de prioridade: baixa, média ou alta.
6. Não inventar fatos. Se não houver evidência suficiente, marque como "verificar manualmente".
7. Termine com uma seção "Ações recomendadas" em ordem prática de execução.

Catálogo atual:
${JSON.stringify(catalog, null, 2)}
    `.trim();

    const { response, data, result } = await callGemini({
      apiKey,
      model,
      prompt,
      useGoogleSearch
    });

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(response.status >= 400 && response.status < 600 ? response.status : 502).json({
        error: data?.error?.message || 'A API do Gemini recusou a solicitação.'
      });
    }

    if (!result.analysis) {
      console.error('Gemini response without usable output:', JSON.stringify(data).slice(0, 5000));
      return res.status(502).json({
        error: 'O Gemini respondeu, mas não foi possível extrair o relatório.'
      });
    }

    return res.status(200).json({
      model,
      useGoogleSearch,
      generatedAt: new Date().toISOString(),
      analysis: result.analysis,
      citations: result.citations
    });
  } catch (error) {
    console.error('gemini-maintenance:', error.cause || error);
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Falha ao executar a manutenção inteligente.'
    });
  }
};
