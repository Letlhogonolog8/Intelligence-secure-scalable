import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || '*'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const { text, labels, task } = await req.json()

    if (!text || typeof text !== 'string') {
      return jsonResponse({ error: '`text` must be a non-empty string' }, 400)
    }
    if (!labels || !Array.isArray(labels) || labels.length === 0) {
      return jsonResponse({ error: '`labels` must be a non-empty array of strings' }, 400)
    }
    const validTasks = ['intent', 'sentiment', 'classify'] as const
    if (!task || !validTasks.includes(task)) {
      return jsonResponse({ error: `\`task\` must be one of: ${validTasks.join(', ')}` }, 400)
    }

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_API_KEY) {
      return jsonResponse({ error: 'GROQ_API_KEY is not configured' }, 500)
    }

    const taskDescriptions: Record<string, string> = {
      intent: 'Classify the user intent of the following text',
      sentiment: 'Classify the sentiment of the following text',
      classify: 'Classify the following text',
    }

    const systemPrompt = `You are a precise text classification engine. ${taskDescriptions[task]} into exactly one of the provided labels. Respond ONLY with valid JSON, no markdown fences, no explanation.

Required output format:
{"primary":"<best_label>","confidence":<0_to_1>,"allScores":{<label>:<score>,...}}

Rules:
- "primary" must be one of the provided labels
- "confidence" is a float between 0 and 1
- "allScores" must contain every provided label with a float score between 0 and 1
- All scores should roughly sum to 1`

    const userPrompt = `Text: "${text}"
Labels: ${JSON.stringify(labels)}`

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 256,
      }),
    })

    if (!groqResponse.ok) {
      const err = await groqResponse.text()
      return jsonResponse({ error: `Groq API error: ${err}` }, 502)
    }

    const groqResult = await groqResponse.json()
    const raw = groqResult?.choices?.[0]?.message?.content?.trim() ?? ''

    let parsed: { primary: string; confidence: number; allScores: Record<string, number> }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return jsonResponse({ error: 'Failed to parse classification response', raw }, 502)
    }

    if (!labels.includes(parsed.primary)) {
      parsed.primary = labels[0]
    }

    parsed.confidence = clamp(Number(parsed.confidence) || 0, 0, 1)

    const clampedScores: Record<string, number> = {}
    for (const label of labels) {
      clampedScores[label] = clamp(Number(parsed.allScores?.[label]) || 0, 0, 1)
    }
    parsed.allScores = clampedScores

    return jsonResponse({
      primary: parsed.primary,
      confidence: parsed.confidence,
      allScores: parsed.allScores,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
