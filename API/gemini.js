export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = 'AlzaSyA_zKKKcJOy35EvMZthYh0qFazyVS240ak';
  const { prompt } = req.body || {};

  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  // Try gemini-2.0-flash first, fall back to gemini-1.5-flash
  const models = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
  ];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 512,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        // If model not found, try next
        if (response.status === 404 || response.status === 400) continue;
        return res.status(response.status).json({ error: errData.error?.message || 'Gemini API error', details: errData });
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!text) {
        // Check for safety blocks
        const reason = data.candidates?.[0]?.finishReason;
        if (reason === 'SAFETY') return res.status(200).json({ text: 'This question was flagged by the safety filter. Please review the question content.' });
        return res.status(200).json({ text: 'No explanation generated. Please try again.' });
      }

      return res.status(200).json({ text: text.trim() });
    } catch (e) {
      if (e.code === 'ENOTFOUND' || e.code === 'ETIMEDOUT') {
        return res.status(503).json({ error: 'Network error reaching Gemini API' });
      }
      // Try next model
      continue;
    }
  }

  return res.status(500).json({ error: 'All Gemini models failed. Check your API key.' });
}
