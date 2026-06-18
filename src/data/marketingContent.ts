/**
 * Content registry for the public marketing / legal pages linked from the
 * landing-page footer. Rendered by src/pages/InfoPage.tsx via the /info/:slug
 * route. Keep copy concise, accurate, and survivor-centered.
 */

export interface InfoSection {
  heading: string;
  body?: string;
  bullets?: string[];
}

export interface PricingTier {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

export interface InfoContent {
  title: string;
  subtitle: string;
  sections?: InfoSection[];
  faqs?: { q: string; a: string }[];
  pricing?: PricingTier[];
}

export const MARKETING_PAGES: Record<string, InfoContent> = {
  // ---------------- Platform ----------------
  features: {
    title: "Features",
    subtitle:
      "Everything survivors, responders, and organizations need to report, respond, and recover — in one secure platform.",
    sections: [
      {
        heading: "Safe, multi-channel reporting",
        body: "Survivors and community members can report through the app, WhatsApp, or USSD — online or offline, named or anonymous, by text or voice.",
      },
      {
        heading: "AI risk assessment & triage",
        body: "Every report is scored for risk and routed to the right responders in seconds, so the most urgent cases are never lost in a queue.",
      },
      {
        heading: "Coordinated response",
        body: "Police, NGOs, counselors, and health workers collaborate on a shared, access-controlled case record with a full audit trail.",
      },
      {
        heading: "Evidence & voice translation",
        body: "Voice notes are transcribed and translated automatically, and digital evidence is captured with secure metadata and chain-of-custody.",
      },
    ],
  },
  "how-it-works": {
    title: "How AEGIS-AI Works",
    subtitle: "Simple steps that make a real difference.",
    sections: [
      {
        heading: "1. Report",
        body: "Report incidents safely and anonymously through the channel that works for you.",
      },
      {
        heading: "2. Assess",
        body: "AI assesses risk and prioritizes cases so urgent situations rise to the top.",
      },
      {
        heading: "3. Coordinate",
        body: "The right responders are notified instantly and coordinate on a shared case.",
      },
      {
        heading: "4. Support",
        body: "Survivors are connected to counseling, legal, medical, and shelter services.",
      },
      {
        heading: "5. Protect",
        body: "Ongoing support continues until safety is restored and the case is resolved.",
      },
    ],
  },
  "mobile-app": {
    title: "Mobile App",
    subtitle:
      "Carry safety in your pocket. The AEGIS-AI app puts emergency help, reporting, and support one tap away.",
    sections: [
      {
        heading: "Built for real emergencies",
        bullets: [
          "Emergency SOS, silent SOS, and panic button",
          "Voice, text, and anonymous reporting",
          "Works offline and over USSD on any phone",
          "Quick-escape and stealth modes for safety",
        ],
      },
      {
        heading: "Stay supported",
        bullets: [
          "Track your case status securely",
          "Message counselors and book appointments",
          "Find nearby shelters, clinics, and legal aid",
          "Available in 100+ languages",
        ],
      },
    ],
  },
  pricing: {
    title: "Pricing",
    subtitle:
      "Free forever for survivors. Flexible plans for the organizations that protect them.",
    pricing: [
      {
        name: "Survivor",
        price: "Free",
        tagline: "Always free for individuals seeking help.",
        features: [
          "Emergency SOS & reporting",
          "Case tracking & secure messaging",
          "Resource & shelter directory",
          "100+ languages",
        ],
        cta: "Get Help Now",
      },
      {
        name: "Organization",
        price: "Custom",
        tagline: "For NGOs, counselors, and clinics coordinating response.",
        features: [
          "Case management & coordination",
          "AI risk triage & analytics",
          "Evidence vault & voice translation",
          "Role-based access & audit trails",
        ],
        cta: "Talk to us",
        highlight: true,
      },
      {
        name: "Government",
        price: "Enterprise",
        tagline: "For agencies running national response at scale.",
        features: [
          "Command-center dashboards",
          "Regional hotspot analytics",
          "Multi-agency coordination",
          "Compliance & data residency",
        ],
        cta: "Contact sales",
      },
    ],
  },

  // ---------------- Resources ----------------
  "safety-tips": {
    title: "Safety Tips",
    subtitle:
      "Practical steps to help you stay safer. If you are in immediate danger, call the police on 10111.",
    sections: [
      {
        heading: "Plan ahead",
        bullets: [
          "Identify a safe place you can go to quickly",
          "Keep important documents and some cash accessible",
          "Agree on a code word with someone you trust",
          "Save emergency numbers and the AEGIS USSD code *135*1782#",
        ],
      },
      {
        heading: "Protect your privacy",
        bullets: [
          "Use the app's quick-escape and stealth modes",
          "Clear your browser history after seeking help",
          "Consider a device the person harming you cannot access",
        ],
      },
    ],
  },
  "support-services": {
    title: "Support Services",
    subtitle:
      "AEGIS-AI connects you to a network of vetted services across counseling, legal, medical, and shelter support.",
    sections: [
      {
        heading: "Counseling & psychosocial",
        body: "Trauma-informed counselors and peer support, available remotely or in person.",
      },
      {
        heading: "Legal assistance",
        body: "Guidance on protection orders, reporting, and navigating the justice system.",
      },
      {
        heading: "Medical care",
        body: "Referrals to clinics and hospitals for urgent and follow-up care.",
      },
      {
        heading: "Safe shelter",
        body: "Connections to nearby shelters and safe houses when you need to leave.",
      },
    ],
  },
  guides: {
    title: "Guides",
    subtitle: "Step-by-step guides for survivors, responders, and partners.",
    sections: [
      {
        heading: "For survivors",
        body: "How to report safely, what happens next, and how to track your case.",
      },
      {
        heading: "For responders",
        body: "How to triage, coordinate, and document cases within the platform.",
      },
      {
        heading: "For organizations",
        body: "How to onboard your team, manage roles, and run analytics.",
      },
    ],
  },
  faq: {
    title: "Frequently Asked Questions",
    subtitle: "Answers to the questions we hear most often.",
    faqs: [
      {
        q: "Is AEGIS-AI free to use?",
        a: "Yes. The platform is always free for survivors and community members. Organizations and governments use paid plans.",
      },
      {
        q: "Can I report anonymously?",
        a: "Absolutely. You can report without sharing your identity, and you control what information is shared and with whom.",
      },
      {
        q: "Does it work without internet?",
        a: "Yes. You can report over USSD by dialing *135*1782# from any phone, and the app supports offline reporting that syncs later.",
      },
      {
        q: "Is my data secure?",
        a: "Your data is end-to-end encrypted, access-controlled, and handled under privacy-by-design principles aligned with POPIA.",
      },
      {
        q: "Who sees my report?",
        a: "Only the responders you are routed to, based on consent and role-based access. Every access is logged in an audit trail.",
      },
      {
        q: "What languages are supported?",
        a: "Over 100 languages, with automatic voice transcription and translation between survivors and responders.",
      },
    ],
  },

  // ---------------- Company ----------------
  about: {
    title: "About AEGIS-AI",
    subtitle:
      "We are building a safer world for all survivors of gender-based violence.",
    sections: [
      {
        heading: "Our mission",
        body: "AEGIS-AI ensures survivors of gender-based violence get the help, protection, and justice they deserve — through technology that is survivor-centered, confidential, and human at its core.",
      },
      {
        heading: "Why we exist",
        body: "Too often, survivors face fragmented services, long delays, and barriers to reporting. We connect survivors, responders, and organizations on one real-time platform so help arrives faster and no one is left behind.",
      },
      {
        heading: "Our principles",
        bullets: [
          "Survivor safety and informed consent first",
          "Confidentiality and privacy by design",
          "Accessibility, inclusivity, and cultural sensitivity",
          "Accountability, transparency, and AI for social good",
        ],
      },
    ],
  },
  partners: {
    title: "Partners",
    subtitle:
      "AEGIS-AI works with governments, NGOs, health systems, and law enforcement to end gender-based violence.",
    sections: [
      {
        heading: "NGOs & civil society",
        body: "Coordinate cases, manage referrals, and measure impact across your programs.",
      },
      {
        heading: "Law enforcement",
        body: "Receive prioritized incidents in real time and respond with full context.",
      },
      {
        heading: "Health & social services",
        body: "Deliver timely, trauma-informed care with secure referrals.",
      },
      {
        heading: "Governments",
        body: "Run national response with hotspot analytics and multi-agency coordination.",
      },
    ],
  },
  news: {
    title: "News",
    subtitle:
      "Updates, announcements, and stories from the AEGIS-AI community.",
    sections: [
      {
        heading: "Building in the open",
        body: "We share product milestones, research, and impact stories as the platform grows. Check back soon for the latest updates.",
      },
    ],
  },
  careers: {
    title: "Careers",
    subtitle:
      "Help us build technology that protects survivors and saves lives.",
    sections: [
      {
        heading: "Work that matters",
        body: "We are a mission-driven team of engineers, designers, researchers, and social-impact specialists. Every role here contributes directly to survivor safety.",
      },
      {
        heading: "How we work",
        bullets: [
          "Remote-friendly and globally distributed",
          "Trauma-informed, inclusive culture",
          "Real ownership and measurable impact",
        ],
      },
      {
        heading: "Open roles",
        body: "We are always interested in meeting people who care about this mission. Reach out through the Get Help / contact channels and tell us how you would like to contribute.",
      },
    ],
  },

  // ---------------- Legal ----------------
  privacy: {
    title: "Privacy Policy",
    subtitle:
      "Your privacy and safety come first. This summary explains how we handle your information.",
    sections: [
      {
        heading: "What we collect",
        body: "Only the information needed to provide help — such as the details you choose to include in a report. Anonymous reporting is always available.",
      },
      {
        heading: "How we use it",
        body: "To assess risk, route your case to appropriate responders, and provide support. We never sell your data.",
      },
      {
        heading: "Who can access it",
        body: "Access is strictly role-based and consent-driven, and every access is recorded in an immutable audit trail.",
      },
      {
        heading: "Your rights",
        body: "You can request access to, correction of, or deletion of your data, subject to legal and safety obligations.",
      },
      {
        heading: "Contact",
        body: "For privacy questions or data requests, contact us through the support channels in the app.",
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    subtitle: "The terms that govern your use of AEGIS-AI.",
    sections: [
      {
        heading: "Acceptable use",
        body: "AEGIS-AI is provided to help survivors and the people and organizations that support them. Misuse, including false reporting or unauthorized access, is prohibited.",
      },
      {
        heading: "Not an emergency service",
        body: "AEGIS-AI complements but does not replace emergency services. In immediate danger, call the police on 10111 or the crisis line on 0800 428 428.",
      },
      {
        heading: "Accounts & access",
        body: "Organizational users must protect their credentials and use the platform only within their authorized role.",
      },
      {
        heading: "Changes",
        body: "We may update these terms as the platform evolves. Continued use means you accept the current terms.",
      },
    ],
  },
  "data-protection": {
    title: "Data Protection",
    subtitle: "Security and compliance built into every layer of the platform.",
    sections: [
      {
        heading: "Security by design",
        bullets: [
          "End-to-end encryption (AES-256) for sensitive data",
          "Role-based access control and least privilege",
          "Immutable, tamper-evident audit logging",
          "Encrypted location and survivor profile vaults",
        ],
      },
      {
        heading: "Compliance",
        body: "Our practices are aligned with POPIA and informed by global data-protection standards, with privacy-by-design and informed consent at the center.",
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    subtitle: "How we use cookies and similar technologies.",
    sections: [
      {
        heading: "Essential cookies",
        body: "Required for the platform to function securely, such as keeping you signed in.",
      },
      {
        heading: "Preferences",
        body: "Remember choices like your language so your experience stays consistent.",
      },
      {
        heading: "Your choices",
        body: "You can control cookies through your browser settings. Disabling essential cookies may limit functionality.",
      },
    ],
  },
};

export const getMarketingPage = (slug: string): InfoContent | undefined =>
  MARKETING_PAGES[slug];
