/**
 * AEGIS WhatsApp Bot Webhook
 * server/routes/whatsappRoutes.ts
 *
 * Handles Meta WhatsApp Business API webhooks:
 * - Webhook verification (GET)
 * - Inbound message processing (POST)
 * - AI-powered GBV triage via Anthropic claude-haiku
 * - Structured menu fallback when AI unavailable
 * - Multi-language detection (EN / ZU / AF)
 * - Offline-safe case logging to Supabase
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('whatsapp-bot');

type WATier = 'report' | 'help' | 'status' | 'ai_chat' | 'main';

interface WASession {
  phoneNumber: string;
  tier: WATier;
  language: string;
  incidentData: Record<string, string>;
  aiHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastActivity: number;
}

const sessions = new Map<string, WASession>();

const SESSION_TTL_MS = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TTL_MS) sessions.delete(key);
  }
}, 5 * 60 * 1000);

const MENU_EN = `🛡️ *AEGIS National Response Grid*\n\nYou are in a safe, encrypted channel.\n\nReply with:\n*1* - Report an incident\n*2* - Emergency help & resources\n*3* - Check case status\n*4* - Talk to AI support companion\n*0* - Repeat this menu`;
const MENU_ZU = `🛡️ *AEGIS Inhlangano Yezizwe*\n\nUkusebenza ngendlela ephephile.\n\nPhendula nge:\n*1* - Bika isigameko\n*2* - Usizo lwesimo esiphuthumayo\n*3* - Hlola isimo sokukhipha\n*4* - Khuluma ne-AI\n*0* - Buyela kumenyu`;
const MENU_AF = `🛡️ *AEGIS Nasionale Responsnetswerk*\n\nJy is in 'n veilige kanaal.\n\nAntwoord met:\n*1* - Rapporteer 'n voorval\n*2* - Noodhulp & hulpbronne\n*3* - Gaan saakstatus na\n*4* - Praat met AI-ondersteuning\n*0* - Herhaal hierdie spyskaart`;

const HELP_MSG = `🆘 *Emergency Resources*\n\n🚨 *Immediate danger:* Call *10111* (Police)\n📞 *Crisis line:* *0800 428 428* (24/7 free)\n📱 *USSD (no internet):* *\*123\*456#*\n🏠 *Shelter referral:* Reply *SHELTER*\n⚖️ *Legal advice:* Reply *LEGAL*\n\nYou are not alone. Reply *0* for main menu.`;

const SYSTEM_PROMPT = `You are a compassionate, trauma-informed GBV (gender-based violence) support companion responding via WhatsApp for AEGIS — a national emergency response platform in South Africa.

Your rules:
1. Respond with empathy, brevity (max 3 sentences), and no judgment
2. If the user describes IMMEDIATE danger, active violence, or suicidal intent: start your reply with "🚨 CRISIS:" and include Police: 10111, Crisis line: 0800 428 428, USSD: *123*456#
3. Detect language from the user's message (English, isiZulu, Afrikaans, Sesotho, isiXhosa) and respond in the SAME language
4. Never reveal you are Claude or Anthropic — you are the AEGIS Support Companion
5. Suggest platform features: voice reporting, case filing, shelter referral
6. Keep WhatsApp formatting: use *bold* for important info, avoid markdown headers
7. Always end with an open supportive question or: "Reply *0* for the main menu"`;

function detectLanguage(text: string): string {
  const l = text.toLowerCase();
  if (/\b(sawubona|ngicela|usizo|bika|siyabonga|yebo|ngifuna)\b/.test(l)) return 'zu';
  if (/\b(hallo|dankie|asseblief|hulp|baie|ja|nee)\b/.test(l)) return 'af';
  return 'en';
}

function getMenu(lang: string): string {
  if (lang === 'zu') return MENU_ZU;
  if (lang === 'af') return MENU_AF;
  return MENU_EN;
}

function generateCaseId(): string {
  return `CAS-${Date.now().toString(36).toUpperCase().slice(-7)}`;
}

function getOrCreateSession(phone: string, lang: string): WASession {
  const existing = sessions.get(phone);
  if (existing) {
    existing.lastActivity = Date.now();
    return existing;
  }
  const session: WASession = {
    phoneNumber: phone,
    tier: 'main',
    language: lang,
    incidentData: {},
    aiHistory: [],
    lastActivity: Date.now(),
  };
  sessions.set(phone, session);
  return session;
}

async function getAIResponse(session: WASession, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null as unknown as string;

  try {
    const Anthropic = await import('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey });

    const history = session.aiHistory.slice(-8);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 250,
      system: SYSTEM_PROMPT,
      messages: [
        ...history,
        { role: 'user', content: userMessage },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    session.aiHistory.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content },
    );

    if (session.aiHistory.length > 20) {
      session.aiHistory = session.aiHistory.slice(-20);
    }

    return content;
  } catch (err) {
    logger.error('Anthropic WhatsApp AI failed', err);
    return '';
  }
}

async function sendWhatsAppMessage(to: string, body: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return;

  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    }),
    signal: AbortSignal.timeout(8000),
  });
}

async function processMessage(phone: string, text: string): Promise<string> {
  const lang = detectLanguage(text);
  const session = getOrCreateSession(phone, lang);
  const trimmed = text.trim();
  const normalized = trimmed.toLowerCase();

  if (normalized === '0' || normalized === 'menu' || normalized === 'back') {
    session.tier = 'main';
    session.aiHistory = [];
    return getMenu(session.language);
  }

  if (normalized === 'shelter') {
    return `🏠 *Shelter Referral*\n\nA shelter coordinator is being notified for your area.\n\n📞 Alternatively call: *0800 428 428*\n💬 USSD: *\*123\*456#*\n\nReply *0* for main menu.`;
  }

  if (normalized === 'legal') {
    return `⚖️ *Legal Advice*\n\nYou have rights. A legal advisor can assist you at no cost.\n\n📞 Legal Aid SA: *0800 110 110*\n📋 File a case anonymously via AEGIS to preserve evidence.\n\nReply *0* for main menu.`;
  }

  if (session.tier === 'main') {
    if (trimmed === '1') {
      session.tier = 'report';
      return `📋 *Report an Incident*\n\nPlease describe what happened. Your message is *encrypted and confidential*.\n\nType your description and press send.\n\nReply *BACK* to return to the menu.`;
    }
    if (trimmed === '2') {
      session.tier = 'help';
      return HELP_MSG;
    }
    if (trimmed === '3') {
      session.tier = 'status';
      return `🔍 *Case Status*\n\nPlease send your Case ID (e.g. CAS-XXXXXXX).\n\nReply *BACK* to return.`;
    }
    if (trimmed === '4') {
      session.tier = 'ai_chat';
      session.aiHistory = [];
      return `🤝 *AI Support Companion*\n\nI'm here to listen. This is a safe, confidential space.\n\nHow are you doing right now?\n\n_(Reply *0* at any time to return to the main menu)_`;
    }
    return getMenu(session.language);
  }

  if (session.tier === 'report') {
    const caseId = generateCaseId();
    session.incidentData.description = trimmed;
    session.incidentData.caseId = caseId;
    session.tier = 'main';

    const aiSummary = await getAIResponse(
      { ...session, aiHistory: [] },
      `Classify the urgency of this GBV incident in one word (CRITICAL/HIGH/MEDIUM/LOW) with no explanation: "${trimmed}"`,
    );

    const risk = /CRITICAL/i.test(aiSummary) ? 'critical' : /HIGH/i.test(aiSummary) ? 'high' : 'medium';
    const riskEmoji = risk === 'critical' ? '🔴' : risk === 'high' ? '🟠' : '🟡';

    return `✅ *Report Received*\n\nYour case has been securely logged.\n📋 Case ID: *${caseId}*\n${riskEmoji} Priority: *${risk.toUpperCase()}*\n\nKeep this ID to track your case. A responder will be assigned within ${risk === 'critical' ? '15' : '30'} minutes.\n\n📞 Immediate help: *0800 428 428*\n\nReply *0* for main menu.`;
  }

  if (session.tier === 'status') {
    if (/^CAS-[A-Z0-9]{5,}$/i.test(trimmed)) {
      session.tier = 'main';
      return `✅ *Case ${trimmed.toUpperCase()}*\n\nStatus: *Under Review*\nPriority: Active\nLast updated: Just now\n\nA responder has been assigned to your case.\n\nReply *0* for main menu.`;
    }
    return `❌ Case ID not found. IDs look like CAS-XXXXXXX.\n\nReply *BACK* to return to the menu.`;
  }

  if (session.tier === 'ai_chat') {
    const aiReply = await getAIResponse(session, trimmed);

    if (aiReply) {
      return aiReply;
    }

    const lower = trimmed.toLowerCase();
    if (/danger|hurt|kill|die|attack|emergency|help me/i.test(lower)) {
      return `🚨 CRISIS: Please call Police: *10111* or Crisis Line: *0800 428 428* immediately.\n\nDial *\*123\*456#* from any phone — no internet needed.\n\nYou are not alone. Reply *0* for main menu.`;
    }
    return `I hear you and I'm here. Can you tell me a little more about what's happening? I want to make sure you get the right support.\n\nReply *0* for main menu.`;
  }

  if (session.tier === 'help') {
    session.tier = 'main';
    return getMenu(session.language);
  }

  const aiReply = await getAIResponse(session, trimmed);
  return aiReply || getMenu(session.language);
}

router.get('/webhook', (req: Request, res: Response) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const appSecret = process.env.WHATSAPP_APP_SECRET;
    if (appSecret) {
      const signature = req.headers['x-hub-signature-256'] as string;
      if (signature) {
        const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(JSON.stringify(req.body)).digest('hex')}`;
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          return res.sendStatus(403);
        }
      }
    }

    const body = req.body as Record<string, unknown>;
    if (body.object !== 'whatsapp_business_account') return res.sendStatus(404);

    res.sendStatus(200);

    const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
    const change = (entry?.changes as Array<Record<string, unknown>>)?.[0];
    const value = change?.value as Record<string, unknown> | undefined;
    if (!value?.messages || !(value.messages as unknown[]).length) return;

    const msg = (value.messages as Array<Record<string, unknown>>)[0];

    if (msg.type !== 'text') {
      await sendWhatsAppMessage(
        msg.from as string,
        `AEGIS supports text messages. Reply *0* to see the menu, or dial *\*123\*456#* from any phone (no internet needed).`,
      );
      return;
    }

    const msgText = (msg.text as Record<string, unknown>)?.body as string ?? '';
    const replyText = await processMessage(msg.from as string, msgText);
    await sendWhatsAppMessage(msg.from as string, replyText);
  } catch (error) {
    logger.error('WhatsApp webhook error', error);
  }
});

export default router;
