import Groq from 'groq-sdk';

const apiKey = (import.meta.env.VITE_GROQ_API_KEY || '').trim();

const client = new Groq({ 
  apiKey,
  dangerouslyAllowBrowser: true 
});

const ensureApiKey = () => {
  if (!apiKey) {
    throw new Error('Missing VITE_GROQ_API_KEY. Restart dev server after setting it.');
  }
};

const extractGroqError = (err: any) => {
  const message = err?.response?.error?.message || err?.message || 'Groq request failed.';
  const status = err?.status || err?.response?.status;
  return status ? `${message} (HTTP ${status})` : message;
};

const AUDIT_PROMPT = `You are a document auditing AI. Analyze the provided document image and return a JSON object matching this exact schema: { document_type, confidence, extracted_fields, anomalies, summary }. 
Return ONLY valid JSON. No markdown, no explanation.`;

export async function auditDocument(imageBase64: string): Promise<{ content: string; latency: number }> {
  ensureApiKey();
  const start = Date.now();
  try {
    const response = await client.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user' as const,
        content: [
          { type: 'text', text: AUDIT_PROMPT },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }],
      response_format: { type: 'json_object' },
    });
    return { 
      content: response.choices[0].message.content || '{}', 
      latency: Date.now() - start 
    };
  } catch (err: any) {
    throw new Error(extractGroqError(err));
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  ensureApiKey();
  const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
  try {
    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
    });
    return transcription.text;
  } catch (err: any) {
    throw new Error(extractGroqError(err));
  }
}

export async function getIntelligentResponse(
  userText: string,
  context?: string,
  history?: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  ensureApiKey();
  const sysPrompt = context
    ? `You are Meridian, an elite AI talent intelligence assistant built for senior HR professionals and recruiters. You have already analyzed a candidate document. Answer questions with precision, flag concerns proactively, and give actionable hiring recommendations. Be direct and concise (3-4 sentences). Document context: ${context}`
    : `You are Meridian, an elite AI talent intelligence assistant for HR professionals and recruiters. Provide precise, actionable insights. Be professional, direct, and concise (3-4 sentences max).`;
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system' as const, content: sysPrompt },
        ...(history ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: userText },
      ],
      max_tokens: 400,
    });
    return response.choices[0].message.content || '';
  } catch (err: any) {
    throw new Error(extractGroqError(err));
  }
}

export async function generateSuggestions(context: string, lang: 'en' | 'ar' = 'en'): Promise<string[]> {
  ensureApiKey();
  const prompt = lang === 'ar'
    ? `بناءً على سياق المستند التالي، اقترح 4 أسئلة قصيرة مفيدة يمكن لمسؤول التوظيف طرحها. أرجع فقط مصفوفة JSON من النصوص. لا تضف أي شرح. السياق: ${context}`
    : `Based on this document context, suggest 4 short useful questions an HR professional might ask. Return ONLY a JSON array of strings. No explanation. Context: ${context}`;
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user' as const, content: prompt }],
      max_tokens: 200,
      response_format: { type: 'json_object' },
    });
    const raw = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (parsed.questions ?? parsed.suggestions ?? Object.values(parsed)[0]);
    return Array.isArray(arr) ? arr.slice(0, 4).map(String) : [];
  } catch {
    return lang === 'ar'
      ? ['لخص المؤهلات الرئيسية', 'هل توجد نقاط تخوف؟', 'ما درجة ملاءمة المرشح؟', 'اقترح أسئلة للمقابلة']
      : ['Summarize key qualifications', 'Any red flags?', 'Rate overall candidate fit', 'Suggest interview questions'];
  }
}
