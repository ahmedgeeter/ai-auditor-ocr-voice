import Groq from 'groq-sdk';

const apiKey = import.meta.env.VITE_GROQ_API_KEY;

const client = new Groq({ 
  apiKey: apiKey || 'demo_key',
  dangerouslyAllowBrowser: true 
});

const AUDIT_PROMPT = `You are a document auditing AI. Analyze the provided document image and return a JSON object matching this exact schema: { document_type, confidence, extracted_fields, anomalies, summary }. 
Return ONLY valid JSON. No markdown, no explanation.`;

export async function auditDocument(imageBase64: string): Promise<{ content: string; latency: number }> {
  const start = Date.now();
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
}

export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
  const transcription = await client.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
  });
  return transcription.text;
}

export async function getIntelligentResponse(userText: string, context?: string): Promise<string> {
  const response = await client.chat.completions.create({
    model: 'llama3-70b-8192',
    messages: [
      { role: 'system' as const, content: 'You are Meridian, a precise AI auditing assistant. Be concise, technical, and helpful. Answer in 2-3 sentences max.' },
      ...(context ? [{ role: 'system' as const, content: `Document context: ${context}` }] : []),
      { role: 'user' as const, content: userText }
    ],
    max_tokens: 300,
  });
  return response.choices[0].message.content || '';
}
