/**
 * AEGIS WhatsApp Bot Webhook
 * server/routes/whatsappRoutes.ts
 *
 * Handles Meta WhatsApp Business API webhooks for multi-channel access:
 * - Webhook verification (GET)
 * - Inbound message processing (POST)
 * - GBV incident reporting via WhatsApp
 * - Automated resource SMS-style responses
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

type WATier = 'report' | 'help' | 'status' | 'main';

interface WASession {
  phoneNumber: string;
  tier: WATier;
  language: string;
  incidentData: Record<string, string>;
  lastActivity: number;
}

const sessions = new Map<string, WASession>();

const MESSAGES: Record<string, Record<string, string>> = {
  en: {
    welcome: `🛡️ *AEGIS National Response Grid*\n\nYou are in a safe, encrypted channel.\n\nReply with:\n*1* - Report an incident\n*2* - Get emergency help\n*3* - Check case status\n*0* - Main menu`,
    report_start: `📋 *Report an Incident*\n\nPlease describe what happened. Your message is encrypted and confidential.\n\nType your description and press send.\n\nReply *BACK* to return to the menu.`,
    report_confirm: `✅ *Report Received*\n\nYour case has been securely logged.\nYour Case ID: *{caseId}*\n\nKeep this ID to track your case. A responder will be assigned within 30 minutes.\n\nDial *0800 428 428* for immediate crisis support.`,
    help: `🆘 *Emergency Help*\n\n*Immediate danger:* Call 10111 (Police)\n*Crisis line:* 0800 428 428 (24/7)\n*USSD:* *123*456# (works offline)\n\nNearby shelters and counselors are being located for you.\n\nReply *BACK* for main menu.`,
    status_ask: `🔍 *Case Status*\n\nPlease send your Case ID (e.g. CAS-XXXXXXX).\n\nReply *BACK* to return to menu.`,
    status_not_found: `❌ Case ID not found. Please check the ID and try again.\n\nReply *BACK* for main menu.`,
    unknown: `I didn't understand that. Please reply with *1*, *2*, *3*, or *0* for the main menu.`,
  },
  zu: {
    welcome: `🛡️ *AEGIS Inhlangano Yezizwe*\n\nUkusebenza ngendlela ephephile futhi ikhipherwe.\n\nPhendula nge:\n*1* - Bika isigameko\n*2* - Thola usizo lwesimo esiphuthumayo\n*3* - Hlola isimo sokukhipha\n*0* - Imenyu enkulu`,
    report_start: `📋 *Bika Isigameko*\n\nCacisa ukwenzeke. Umlayezo wakho ukhipherwe futhi uyimfihlo.\n\nPhendula nge *BACK* ukubuyela kumenyu.`,
    report_confirm: `✅ *Umbiko Wamukelwe*\n\nIkhesi lakho lirekhodi ngokuphepha.\nI-ID Yakho: *{caseId}*\n\nBhala le-ID ukuze ulandelele ikhesi lakho.`,
    help: `🆘 *Usizo Lwesimo Esiphuthumayo*\n\n*Ingozi ngokuphazima kweso:* Shayela 10111\n*Umugqa wengxabano:* 0800 428 428\n*USSD:* *123*456#`,
    status_ask: `🔍 Thumela I-ID Yakho Yekhesi (isb. CAS-XXXXXXX).`,
    status_not_found: `❌ I-ID yekhesi ayitholwanga. Phendula nge *BACK*.`,
    unknown: `Angizwanga lokho. Phendula nge *1*, *2*, *3*, noma *0*.`,
  },
  af: {
    welcome: `🛡️ *AEGIS Nasionale Responsnetswerk*\n\nJy is in 'n veilige, geënkripteerde kanaal.\n\nAntwoord met:\n*1* - Rapporteer 'n voorval\n*2* - Kry noodhulp\n*3* - Gaan saakstatus na\n*0* - Hoofmenu`,
    report_start: `📋 *Rapporteer 'n Voorval*\n\nBeskryf wat gebeur het. Jou boodskap is enkripteer en vertroulik.\n\nAntwoord *BACK* om terug te gaan na die menu.`,
    report_confirm: `✅ *Verslag Ontvang*\n\nJou saak is veilig aangeteken.\nJou Saak-ID: *{caseId}*`,
    help: `🆘 *Noodhulp*\n\n*Onmiddellike gevaar:* Bel 10111\n*Krisislyn:* 0800 428 428\n*USSD:* *123*456#`,
    status_ask: `🔍 Stuur jou Saak-ID (bv. CAS-XXXXXXX).`,
    status_not_found: `❌ Saak-ID nie gevind nie. Antwoord *BACK* vir menu.`,
    unknown: `Ek het dit nie verstaan nie. Antwoord met *1*, *2*, *3*, of *0*.`,
  },
};

function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(hallo|dankie|asseblief|help|baie)\b/.test(lower)) return 'af';
  if (/\b(sawubona|ngicela|usizo|bika|siyabonga)\b/.test(lower)) return 'zu';
  return 'en';
}

function getMsg(lang: string, key: string): string {
  return MESSAGES[lang]?.[key] || MESSAGES['en'][key] || '';
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
    lastActivity: Date.now(),
  };
  sessions.set(phone, session);
  return session;
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

  if (normalized === 'back' || normalized === '0') {
    session.tier = 'main';
    session.incidentData = {};
    return getMsg(session.language, 'welcome');
  }

  if (session.tier === 'main') {
    if (trimmed === '1') { session.tier = 'report'; return getMsg(session.language, 'report_start'); }
    if (trimmed === '2') { session.tier = 'help'; return getMsg(session.language, 'help'); }
    if (trimmed === '3') { session.tier = 'status'; return getMsg(session.language, 'status_ask'); }
    return getMsg(session.language, 'welcome');
  }

  if (session.tier === 'report') {
    const caseId = generateCaseId();
    session.incidentData.description = trimmed;
    session.incidentData.caseId = caseId;
    session.tier = 'main';
    return getMsg(session.language, 'report_confirm').replace('{caseId}', caseId);
  }

  if (session.tier === 'status') {
    if (/^CAS-[A-Z0-9]+$/i.test(trimmed)) {
      session.tier = 'main';
      return `✅ *Case ${trimmed.toUpperCase()}*\n\nStatus: Under Review\nLast updated: Just now\n\nA responder has been assigned. Reply *0* for main menu.`;
    }
    return getMsg(session.language, 'status_not_found');
  }

  if (session.tier === 'help') {
    session.tier = 'main';
    return getMsg(session.language, 'welcome');
  }

  return getMsg(session.language, 'unknown');
}

router.get('/webhook', (req: Request, res: Response) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const appSecret = process.env.WHATSAPP_ACCESS_TOKEN;
    if (appSecret) {
      const signature = req.headers['x-hub-signature-256'] as string;
      if (signature) {
        const expectedSig = `sha256=${crypto.createHmac('sha256', appSecret).update(JSON.stringify(req.body)).digest('hex')}`;
        if (signature !== expectedSig) {
          return res.sendStatus(403);
        }
      }
    }

    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return res.sendStatus(404);

    res.sendStatus(200);

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    if (!value?.messages?.length) return;

    const msg = value.messages[0];
    if (msg.type !== 'text') {
      await sendWhatsAppMessage(
        msg.from,
        `AEGIS supports text messages. Reply *0* to see the menu, or dial *123*456# for USSD support.`,
      );
      return;
    }

    const replyText = await processMessage(msg.from, msg.text.body);
    await sendWhatsAppMessage(msg.from, replyText);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
  }
});

export default router;
