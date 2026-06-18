import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  Bell,
  Brain,
  Building2,
  CheckCircle2,
  Facebook,
  FileText,
  Globe,
  Heart,
  HeartHandshake,
  Instagram,
  Languages,
  Linkedin,
  Lock,
  Menu,
  MessageCircle,
  Phone,
  Shield,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Users,
  X,
  Youtube,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { AegisLogo } from "@/components/AegisLogo";
import { CRISIS_LINE_DISPLAY, CRISIS_LINE_TEL } from "@/lib/crisisContacts";
import { cn } from "@/lib/utils";

const WHATSAPP_DISPLAY = "0600 150 150";
const WHATSAPP_LINK = "https://wa.me/27600150150";
const USSD_CODE = "*135*1782#";

const NAV_LINKS = [
  { label: "Home", target: "top" },
  { label: "About", target: "serve" },
  { label: "Features", target: "ai" },
  { label: "How It Works", target: "how" },
  { label: "Resources", target: "ai" },
  { label: "Partners", target: "impact" },
  { label: "Contact", target: "footer" },
];

const HERO_FEATURES = [
  {
    icon: FileText,
    title: "Report Safely",
    desc: "In any language, any time",
  },
  {
    icon: Bell,
    title: "Get Immediate Help",
    desc: "Real-time emergency alerts",
  },
  {
    icon: Lock,
    title: "Confidential & Secure",
    desc: "Your data is protected",
  },
  {
    icon: Brain,
    title: "AI-Powered Support",
    desc: "Smart, fast and reliable",
  },
  {
    icon: Globe,
    title: "Global & Inclusive",
    desc: "Support for all, everywhere",
  },
];

const WORK_STEPS = [
  {
    icon: FileText,
    title: "Report",
    desc: "Report incidents safely and anonymously.",
  },
  {
    icon: Activity,
    title: "Assess",
    desc: "AI assesses risk and prioritizes cases.",
  },
  {
    icon: Users,
    title: "Coordinate",
    desc: "The right people are notified instantly.",
  },
  {
    icon: HeartHandshake,
    title: "Support",
    desc: "Survivors get connected to services.",
  },
  {
    icon: ShieldCheck,
    title: "Protect",
    desc: "Ongoing support until safety is restored.",
  },
];

const AUDIENCES = [
  {
    icon: Shield,
    title: "Survivors",
    desc: "Report safely and access support.",
  },
  {
    icon: Users,
    title: "Community Members",
    desc: "Report incidents on behalf of others.",
  },
  {
    icon: MessageCircle,
    title: "Counselors",
    desc: "Provide care and track sessions.",
  },
  {
    icon: Building2,
    title: "NGOs",
    desc: "Manage cases and deliver services.",
  },
  {
    icon: ShieldCheck,
    title: "Law Enforcement",
    desc: "Respond, investigate, and protect.",
  },
  {
    icon: Globe,
    title: "Governments",
    desc: "Make data-driven decisions.",
  },
];

const IMPACT_STATS = [
  { icon: Globe, value: "25+", label: "Countries" },
  { icon: Languages, value: "100+", label: "Languages" },
  { icon: Heart, value: "1M+", label: "Lives impacted" },
  { icon: Building2, value: "500+", label: "Partner organizations" },
];

const AI_FEATURES = [
  {
    icon: Brain,
    title: "AI Risk Assessment",
    desc: "Identify high-risk cases instantly.",
  },
  {
    icon: Languages,
    title: "Multilingual Support",
    desc: "Voice & text translation in 100+ languages.",
  },
  {
    icon: Bell,
    title: "Real-time Alerts",
    desc: "Instant notifications to the right responders.",
  },
  {
    icon: TrendingUp,
    title: "Predictive Insights",
    desc: "Anticipate risks and prevent harm.",
  },
  {
    icon: Lock,
    title: "Secure & Private",
    desc: "End-to-end encryption and consent driven.",
  },
];

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: ["Features", "How It Works", "Mobile App", "Pricing"],
  },
  {
    title: "Resources",
    links: ["Safety Tips", "Support Services", "Guides", "FAQ"],
  },
  { title: "Company", links: ["About Us", "Partners", "News", "Careers"] },
  {
    title: "Legal",
    links: [
      "Privacy Policy",
      "Terms of Use",
      "Data Protection",
      "Cookie Policy",
    ],
  },
];

const SOCIAL_ICONS = [
  { Icon: Facebook, label: "Facebook" },
  { Icon: X, label: "X (Twitter)" },
  { Icon: Instagram, label: "Instagram" },
  { Icon: Linkedin, label: "LinkedIn" },
  { Icon: Youtube, label: "YouTube" },
];

const AppleBadge: React.FC = () => (
  <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-left transition-colors hover:border-white/30 hover:bg-black/60">
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" aria-hidden="true">
      <path d="M16.36 12.78c-.02-2.06 1.68-3.05 1.76-3.1-.96-1.4-2.46-1.6-2.99-1.62-1.27-.13-2.48.75-3.13.75-.64 0-1.64-.73-2.7-.71-1.39.02-2.67.81-3.39 2.05-1.44 2.5-.37 6.2 1.04 8.23.69.99 1.51 2.1 2.59 2.06 1.04-.04 1.43-.67 2.69-.67 1.25 0 1.61.67 2.71.65 1.12-.02 1.83-1.01 2.51-2.01.79-1.15 1.12-2.27 1.13-2.33-.02-.01-2.17-.83-2.19-3.29zM14.3 6.74c.57-.69.96-1.65.85-2.61-.82.03-1.82.55-2.41 1.24-.53.61-1 1.59-.87 2.53.92.07 1.86-.47 2.43-1.16z" />
    </svg>
    <span className="leading-tight">
      <span className="block text-[9px] uppercase tracking-wide text-slate-300">
        Download on the
      </span>
      <span className="block text-sm font-semibold text-white">App Store</span>
    </span>
  </span>
);

const PlayBadge: React.FC = () => (
  <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-left transition-colors hover:border-white/30 hover:bg-black/60">
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        d="M3.6 2.3 13.4 12 3.6 21.7c-.3-.2-.5-.6-.5-1.1V3.4c0-.5.2-.9.5-1.1z"
        fill="#34d399"
      />
      <path
        d="M17 8.3 13.4 12 17 15.7l3.4-2c.7-.4.7-1.4 0-1.8L17 8.3z"
        fill="#fbbf24"
      />
      <path
        d="m13.4 12-9.8 9.7c.4.3.9.3 1.4 0L17 15.7 13.4 12z"
        fill="#f43f5e"
      />
      <path
        d="M13.4 12 17 8.3 5 1.6c-.5-.3-1-.3-1.4 0L13.4 12z"
        fill="#38bdf8"
      />
    </svg>
    <span className="leading-tight">
      <span className="block text-[9px] uppercase tracking-wide text-slate-300">
        Get it on
      </span>
      <span className="block text-sm font-semibold text-white">
        Google Play
      </span>
    </span>
  </span>
);

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const openAuth = () => {
    setMobileMenuOpen(false);
    navigate("/auth");
  };

  const scrollTo = (target: string) => {
    setMobileMenuOpen(false);
    if (target === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document
      .getElementById(target)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a18] text-white">
      {/* ===================== NAV ===================== */}
      <nav
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled
            ? "border-b border-white/10 bg-[#0a0a18]/85 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <button
            className="flex items-center gap-2.5"
            onClick={() => scrollTo("top")}
          >
            <AegisLogo size={34} />
            <span className="text-lg font-bold tracking-tight">AEGIS-AI</span>
          </button>

          <div className="hidden items-center gap-7 text-sm font-medium text-slate-300 lg:flex">
            {NAV_LINKS.map((item) => (
              <button
                key={item.label}
                className="transition-colors hover:text-violet-300"
                onClick={() => scrollTo(item.target)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitcher variant="compact" />
            <Button
              className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 font-semibold text-white shadow-lg shadow-violet-700/30 hover:opacity-95"
              onClick={openAuth}
            >
              Get Help Now
            </Button>
          </div>

          <button
            className="rounded-lg border border-white/10 p-2 text-slate-200 lg:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#0a0a18]/95 px-4 py-4 backdrop-blur-xl lg:hidden">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((item) => (
                <button
                  key={item.label}
                  className="rounded-lg px-3 py-2.5 text-left text-sm text-slate-200 hover:bg-white/5"
                  onClick={() => scrollTo(item.target)}
                >
                  {item.label}
                </button>
              ))}
              <div className="mt-3 flex items-center justify-between gap-3">
                <LanguageSwitcher variant="compact" />
                <Button
                  className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold"
                  onClick={openAuth}
                >
                  Get Help Now
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ===================== HERO ===================== */}
      <section
        id="top"
        className="relative overflow-hidden pt-28 pb-16 sm:pt-32"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_15%,rgba(168,85,247,0.32),transparent_45%),radial-gradient(circle_at_15%_85%,rgba(124,58,237,0.2),transparent_45%),linear-gradient(160deg,#0a0a18_0%,#140a28_55%,#0a0a18_100%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.5] [background-image:radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:34px_34px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl xl:text-6xl">
              Protecting Survivors.
              <br />
              Connecting Support.
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Saving Lives.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300">
              AEGIS-AI is an AI-powered platform that ensures survivors of
              gender-based violence get the help, protection and justice they
              deserve.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 font-semibold shadow-lg shadow-violet-700/30 hover:opacity-95"
                onClick={openAuth}
              >
                Get Help Now
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white/20 bg-white/5 px-7 font-semibold text-white hover:bg-white/10"
                onClick={() => scrollTo("how")}
              >
                Learn More
              </Button>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Available on
              </p>
              <a
                href="https://play.google.com"
                target="_blank"
                rel="noreferrer"
              >
                <PlayBadge />
              </a>
              <a
                href="https://www.apple.com/app-store/"
                target="_blank"
                rel="noreferrer"
              >
                <AppleBadge />
              </a>
            </div>

            <div className="mt-8 border-t border-white/10 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Need immediate help?
              </p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                <a
                  href={CRISIS_LINE_TEL}
                  className="flex items-center gap-2 font-medium text-slate-200 hover:text-violet-300"
                >
                  <Phone className="h-4 w-4 text-violet-400" />
                  Call {CRISIS_LINE_DISPLAY}
                </a>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 font-medium text-slate-200 hover:text-emerald-300"
                >
                  <MessageCircle className="h-4 w-4 text-emerald-400" />
                  WhatsApp {WHATSAPP_DISPLAY}
                </a>
                <span className="flex items-center gap-2 font-medium text-slate-200">
                  <Smartphone className="h-4 w-4 text-sky-400" />
                  USSD {USSD_CODE}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Hero visual: feature panel over a glowing shield */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-violet-600/30 via-fuchsia-600/10 to-transparent blur-2xl" />
            <div className="mx-auto flex h-full max-w-md flex-col justify-center">
              <div className="mb-6 flex justify-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-2xl shadow-violet-700/40">
                  <Shield className="h-12 w-12 text-white" />
                </div>
              </div>
              <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
                {HERO_FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3 transition-colors hover:border-violet-400/30 hover:bg-violet-500/10"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {f.title}
                      </p>
                      <p className="text-xs text-slate-400">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section id="how" className="bg-slate-50 py-20 text-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-violet-700">
              How AEGIS-AI Works
            </h2>
            <p className="mt-2 text-slate-500">
              Simple steps that make a real difference.
            </p>
          </div>

          <div className="mt-14 flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
            {WORK_STEPS.map((step, i) => (
              <React.Fragment key={step.title}>
                <div className="flex-1 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-100 bg-violet-50 text-violet-600 shadow-sm">
                    <step.icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mx-auto mt-1.5 max-w-[180px] text-sm text-slate-500">
                    {step.desc}
                  </p>
                </div>
                {i < WORK_STEPS.length - 1 && (
                  <div className="hidden items-center pt-5 lg:flex">
                    <ArrowRight className="h-5 w-5 text-violet-300" />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WHO WE SERVE + GLOBAL IMPACT ============ */}
      <section id="serve" className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          {/* Who we serve */}
          <div className="text-slate-900">
            <h2 className="text-center text-2xl font-bold tracking-tight text-violet-700 lg:text-left">
              Who We Serve
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 lg:text-left">
              AEGIS-AI connects individuals and organizations working together
              to end GBV.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {AUDIENCES.map((a) => (
                <div
                  key={a.title}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-center transition-shadow hover:shadow-md"
                >
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                    <a.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-900">
                    {a.title}
                  </h3>
                  <p className="mt-1 text-xs leading-snug text-slate-500">
                    {a.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Global impact */}
          <div
            id="impact"
            className="relative overflow-hidden rounded-3xl bg-[#0c0c1c] p-8 text-white"
          >
            <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(168,85,247,0.45)_1.4px,transparent_1.6px)] [background-size:26px_26px]" />
            <div className="pointer-events-none absolute -right-10 top-10 h-48 w-48 rounded-full bg-violet-600/20 blur-3xl" />
            <div className="relative">
              <h2 className="text-center text-2xl font-bold tracking-tight text-violet-300">
                Global Impact
              </h2>
              <p className="mt-2 text-center text-sm text-slate-400">
                One platform. Global change.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-6">
                {IMPACT_STATS.map((s) => (
                  <div key={s.label} className="text-center">
                    <s.icon className="mx-auto mb-2 h-5 w-5 text-violet-400" />
                    <p className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-3xl font-extrabold text-transparent">
                      {s.value}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-center">
                <Button
                  className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-7 font-semibold shadow-lg shadow-violet-700/30 hover:opacity-95"
                  onClick={openAuth}
                >
                  Join the Movement
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ AI-POWERED. HUMAN-CENTERED. ============ */}
      <section id="ai" className="relative overflow-hidden bg-[#0a0a18] py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.18),transparent_55%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-violet-300">
              AI-Powered. Human-Centered.
            </h2>
            <p className="mt-2 text-slate-400">
              Smarter technology for faster, better outcomes.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {AI_FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center transition-colors hover:border-violet-400/40 hover:bg-violet-500/10"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-xs leading-snug text-slate-400">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer
        id="footer"
        className="border-t border-white/10 bg-[#070710] py-14"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)_1.2fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <AegisLogo size={30} />
                <span className="text-base font-bold">AEGIS-AI</span>
              </div>
              <p className="mt-3 max-w-[220px] text-sm text-slate-400">
                Building a safer world for all survivors of gender-based
                violence.
              </p>
            </div>

            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-white">
                  {col.title}
                </h4>
                <ul className="mt-3 space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <button
                        onClick={openAuth}
                        className="text-sm text-slate-400 transition-colors hover:text-violet-300"
                      >
                        {link}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <h4 className="text-sm font-semibold text-white">Connect</h4>
              <div className="mt-3 flex gap-3">
                {SOCIAL_ICONS.map(({ Icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-violet-400/40 hover:text-violet-300"
                    aria-label={label}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
              <div className="mt-4">
                <LanguageSwitcher variant="compact" />
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row">
            <p>© {new Date().getFullYear()} AEGIS-AI. All rights reserved.</p>
            <div className="flex items-center gap-2 text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              POPIA-aligned · End-to-end encrypted
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
