import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*';

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const rateLimitWindow: Map<string, { count: number; resetAt: number }> = new Map();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

function getRateLimitInfo(clientIp: string): { remaining: number; blocked: boolean } {
  const now = Date.now();
  const entry = rateLimitWindow.get(clientIp);

  if (!entry || now >= entry.resetAt) {
    rateLimitWindow.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { remaining: RATE_LIMIT_MAX - 1, blocked: false };
  }

  entry.count += 1;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  return { remaining, blocked: entry.count > RATE_LIMIT_MAX };
}

function clampTemperature(value: unknown): number {
  const num = typeof value === 'number' ? value : 0.7;
  return Math.min(2, Math.max(0, num));
}

async function verifyJwt(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('Missing Authorization header');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return user.id;
}

async function safeParseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (${response.status}): ${text.slice(0, 200)}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rateLimit = getRateLimitInfo(clientIp);

  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
  };

  if (rateLimit.blocked) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
      {
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        status: 429,
      }
    )
  }

  try {
    const userId = await verifyJwt(req);

    const { messages, context, temperature } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new Error("Messages array is required and cannot be empty")
    }

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'llama-3.1-8b-instant'

    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured")
    }

    const domain = context?.domain || "General"
    const systemPrompt = `You are VDA++, a highly advanced synthetic intelligence assistant specialized in ${domain}. Your goal is to provide autonomous, helpful, and accurate responses based on the user's intent.`

    const groqMessages = messages[0]?.role === 'system'
      ? messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        }))
      : [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqMessages,
        temperature: clampTemperature(temperature),
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      const errorData = await safeParseJson(response);
      throw new Error(`Groq API returned ${response.status}: ${JSON.stringify(errorData)}`)
    }

    const result = await safeParseJson(response) as {
      choices?: { message?: { content?: string } }[];
    };
    const message = result?.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that request."

    return new Response(
      JSON.stringify({
        message,
        metadata: {
          confidence: 0.85,
          sentiment: 'neutral',
          reasoning: `Generated using Groq model ${GROQ_MODEL}`,
          userId,
        }
      }),
      {
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('Invalid or expired token') || message.includes('Missing Authorization')
      ? 401
      : 400;
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, ...rateLimitHeaders, 'Content-Type': 'application/json' },
        status,
      }
    )
  }
})
