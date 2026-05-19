export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = 'AlzaSyA_zKKKcJOy35EvMZthYh0qFazyVS240ak';
  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'No prompt' });

  const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-latest'];
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 512 } }) }
      );
      if (!r.ok) { if (r.status === 404 || r.status === 400) continue; const e = await r.json().catch(() => ({})); return res.status(r.status).json({ error: e.error?.message || 'Gemini error' }); }
      const d = await r.json();
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) return res.status(200).json({ text: 'No explanation generated. Please try again.' });
      return res.status(200).json({ text: text.trim() });
    } catch (e) { continue; }
  }
  return res.status(500).json({ error: 'All Gemini models failed. Check API key.' });
}
