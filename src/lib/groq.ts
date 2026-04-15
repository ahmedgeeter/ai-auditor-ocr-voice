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

// Helper to extract and repair JSON from AI response
const extractJSON = (content: string): string => {
  // Remove markdown code blocks
  let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');

  // Remove control characters that break JSON.parse
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Find the first '{' and last '}'
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBrace !== -1) {
    // JSON appears truncated — take from first '{' to end and attempt repair
    cleaned = cleaned.substring(firstBrace);
    // Close any unclosed string by appending a quote if needed
    const quoteCount = (cleaned.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) cleaned += '"';
    // Count and close unclosed brackets/braces
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    for (let i = 0; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (c === '"' && (i === 0 || cleaned[i - 1] !== '\\')) inString = !inString;
      if (!inString) {
        if (c === '{') openBraces++;
        else if (c === '}') openBraces--;
        else if (c === '[') openBrackets++;
        else if (c === ']') openBrackets--;
      }
    }
    // Remove trailing comma before closing
    cleaned = cleaned.replace(/,\s*$/, '');
    for (let i = 0; i < openBrackets; i++) cleaned += ']';
    for (let i = 0; i < openBraces; i++) cleaned += '}';
  }

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
      max_tokens: 4096,
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

export async function transcribeAudio(audioBlob: Blob, lang: 'en' | 'ar' = 'en'): Promise<string> {
  ensureApiKey();
  const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
  try {
    const transcriptionParams: any = {
      file,
      model: 'whisper-large-v3',
      language: lang === 'ar' ? 'ar' : 'en',
    };

    const transcription = await client.audio.transcriptions.create(transcriptionParams);
    return transcription.text;
  } catch (err: any) {
    throw new Error(extractGroqError(err));
  }
}

export async function getIntelligentResponse(
  userText: string,
  context?: string,
  history?: { role: 'user' | 'assistant'; content: string }[],
  lang: 'en' | 'ar' = 'en'
): Promise<string> {
  ensureApiKey();
  const languageDirective = lang === 'ar'
    ? 'Respond ONLY in Arabic. Use clear professional Arabic, no English unless it is a document field that must stay as-is.'
    : 'Respond ONLY in English.';

  const sysPrompt = context
    ? `You are Meridian, an elite AI talent intelligence assistant built for senior HR professionals and recruiters. You have already analyzed a candidate document. Answer questions with precision, flag concerns proactively, and give actionable hiring recommendations. Be direct and concise (2-4 complete sentences). ${languageDirective} Document context: ${context}`
    : `You are Meridian, an elite AI talent intelligence assistant for HR professionals and recruiters. Provide precise, actionable insights. Be professional, direct, and concise (2-4 complete sentences). ${languageDirective}`;
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system' as const, content: sysPrompt },
        ...(history ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: userText },
      ],
      max_tokens: 650,
    });
    return response.choices[0].message.content || '';
  } catch (err: any) {
    throw new Error(extractGroqError(err));
  }
}

const buildSuggestionContext = (context: string): string => {
  try {
    const parsed = JSON.parse(context);
    const documentType = parsed?.document_type || 'Unknown';
    const summary = parsed?.summary || '';

    const extractedEntries = Object.entries(parsed?.extracted_fields || {})
      .map(([key, val]: [string, any]) => {
        const value = typeof val === 'string' ? val : (val?.value ?? '');
        return [key, String(value)] as [string, string];
      })
      .filter(([, value]) => value && value.trim())
      .slice(0, 16);

    const entities = Array.isArray(parsed?.detected_entities)
      ? parsed.detected_entities.slice(0, 12)
      : [];

    const anomalies = Array.isArray(parsed?.anomalies)
      ? parsed.anomalies
          .slice(0, 6)
          .map((a: any) => ({ type: a?.type || 'info', severity: a?.severity || 'low', description: a?.description || '' }))
      : [];

    return JSON.stringify({
      document_type: documentType,
      summary,
      extracted_fields: extractedEntries,
      detected_entities: entities,
      anomalies,
    });
  } catch {
    return context.slice(0, 2200);
  }
};

const fallbackQuestionsFromContext = (context: string, lang: 'en' | 'ar'): string[] => {
  try {
    const parsed = JSON.parse(context);
    const docType = String(parsed?.document_type || '').toLowerCase();
    const fields = Object.keys(parsed?.extracted_fields || {}).slice(0, 6).map(f => f.replace(/_/g, ' '));
    const firstField = fields[0] || (lang === 'ar' ? 'البيانات الأساسية' : 'key details');

    if (lang === 'ar') {
      if (docType.includes('resume') || docType.includes('cv')) {
        return [
          `ما أقوى نقطة في ${firstField} لدى المرشح؟`,
          'ما أهم فجوة قد تؤثر على القرار؟',
          'ما مدى ملاءمة المرشح للدور المطلوب؟',
          'اقترح 3 أسئلة مقابلة مبنية على هذا الملف'
        ];
      }
      return [
        `ما أهم ملاحظة مرتبطة بـ ${firstField}؟`,
        'هل توجد نقاط خطر يجب التحقق منها؟',
        'ما أهم 3 خطوات تحقق قبل الاعتماد؟',
        'ما ملخص التوصية النهائية بناءً على المستند؟'
      ];
    }

    if (docType.includes('resume') || docType.includes('cv')) {
      return [
        `What is the strongest signal in ${firstField}?`,
        'What is the biggest risk or gap to validate?',
        'How strong is this candidate fit for the target role?',
        'Suggest 3 interview questions based on this profile'
      ];
    }

    return [
      `What is the most important signal in ${firstField}?`,
      'Any critical red flags that require verification?',
      'What 3 checks should be done before approval?',
      'What is the final recommendation based on this document?'
    ];
  } catch {
    return lang === 'ar'
      ? ['ما أهم نقطة قوة في المستند؟', 'هل توجد علامات خطر واضحة؟', 'ما أهم نقطة تحتاج تحقق إضافي؟', 'ما التوصية النهائية؟']
      : ['What is the strongest signal in this document?', 'Any clear red flags?', 'What needs further validation?', 'What is the final recommendation?'];
  }
};

export async function generateSuggestions(context: string, lang: 'en' | 'ar' = 'en'): Promise<string[]> {
  ensureApiKey();
  const conciseContext = buildSuggestionContext(context);
  const prompt = lang === 'ar'
    ? `لديك تحليل مستند حقيقي. أنشئ 4 أسئلة قصيرة دقيقة جدًا ومبنية على التفاصيل الموجودة فعلًا في السياق.
الشروط:
- اجعل كل سؤال مرتبطًا بحقل أو كيان أو ملاحظة من السياق.
- تجنب الأسئلة العامة أو المكررة.
- لا تضف أي مقدمة أو شرح.
أرجع JSON فقط بهذا الشكل: {"questions":["...","...","...","..."]}
السياق: ${conciseContext}`
    : `You have a real document analysis context. Generate 4 concise, high-value questions grounded in the actual context details.
Rules:
- Each question should map to a real field, entity, risk, or insight in context.
- Avoid generic or repetitive questions.
- No explanation text.
Return JSON ONLY in this shape: {"questions":["...","...","...","..."]}
Context: ${conciseContext}`;
  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user' as const, content: prompt }],
      max_tokens: 260,
      response_format: { type: 'json_object' },
    });
    const raw = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (parsed.questions ?? parsed.suggestions ?? Object.values(parsed)[0]);
    if (!Array.isArray(arr)) return fallbackQuestionsFromContext(context, lang);

    const cleaned = arr
      .map(String)
      .map(q => q.trim())
      .filter(Boolean)
      .filter((q, i, all) => all.findIndex(x => x.toLowerCase() === q.toLowerCase()) === i)
      .slice(0, 4);

    return cleaned.length === 4 ? cleaned : fallbackQuestionsFromContext(context, lang);
  } catch {
    return fallbackQuestionsFromContext(context, lang);
  }
}
