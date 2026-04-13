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

const AUDIT_PROMPT = `CRITICAL: Return ONLY a valid JSON object. NO markdown, NO code blocks, NO explanatory text before or after.

You are an intelligent Document Intelligence AI. Analyze the document image and extract ALL information dynamically.

TASK:
1. Identify document type (Invoice, CV/Resume, ID Card, Passport, Contract, Receipt, Certificate, Bank Statement, Legal Agreement, Medical Record, etc.)
2. Extract ALL fields present - adapt to document type (e.g., for contracts: parties, clauses, effective date, termination conditions; for invoices: vendor, line items, totals, tax, payment terms)
3. Each field must have: value, confidence (0.0-1.0), category
4. List all detected entities (names, orgs, amounts, dates, locations)
5. Flag anomalies with severity levels
6. Provide document-specific insights and recommendations

REQUIRED JSON FORMAT:
{"document_type":"string","document_subtype":"string","confidence":0.0-1.0,"extracted_fields":{"field_name":{"value":"string","confidence":0.0-1.0,"category":"string"}},"detected_entities":["string"],"anomalies":[{"type":"warning/error/info","description":"string","severity":"low/medium/high"}],"document_specific_analysis":{"insights":["string"],"verification_status":"verified/partial/suspicious/failed","recommendations":["string"]},"summary":"string"}

RULES:
- Output MUST start with '{' and end with '}'
- NO text before or after JSON
- NO markdown code blocks
- NO explanations
- If unclear, use best guess with lower confidence
- Extract EVERYTHING visible in the image`;

// Helper to extract JSON from AI response
const extractJSON = (content: string): string => {
  // Remove markdown code blocks
  let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
  
  // Find the first '{' and last '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  
  // Remove any text before first '{' and after last '}'
  cleaned = cleaned.trim();
  
  return cleaned;
};

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
      max_tokens: 2048,
    });
    
    const rawContent = response.choices[0].message.content || '{}';
    const cleanedContent = extractJSON(rawContent);
    
    return {
      content: cleanedContent,
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
