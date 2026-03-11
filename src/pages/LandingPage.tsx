import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Lock, Shield, Siren, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const features = [
    {
      icon: Shield,
      title: t('landing.features.security.title'),
      description: t('landing.features.security.desc'),
    },
    {
      icon: Brain,
      title: t('landing.features.ai.title'),
      description: t('landing.features.ai.desc'),
    },
    {
      icon: Siren,
      title: t('landing.features.emergency.title'),
      description: t('landing.features.emergency.desc'),
    },
    {
      icon: Lock,
      title: t('landing.features.survivor.title'),
      description: t('landing.features.survivor.desc'),
    },
  ];

  const heroHighlights = [
    {
      icon: Shield,
      title: "Secure command fabric",
      description: "Federated access control with continuous audit verification.",
    },
    {
      icon: Siren,
      title: "Rapid escalation",
      description: "Automated routing to specialized response teams in seconds.",
    },
    {
      icon: Lock,
      title: "Survivor privacy",
      description: "End-to-end encryption and consent-forward data handling.",
    },
  ];

  const workflowSteps = [
    {
      title: "Verify & Triage",
      description: "Validate identity, classify risk, and prioritize response with AI-backed scoring.",
      metric: "SLA < 5 min",
    },
    {
      title: "Coordinate Response",
      description: "Route to police, NGOs, medical, and legal services with secured handoff logs.",
      metric: "12 ms relay",
    },
    {
      title: "Continuous Oversight",
      description: "Monitor outcomes, compliance checkpoints, and survivor follow-ups in one view.",
      metric: "24/7 monitoring",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const handleNavClick = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7 } },
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_20%_15%,rgba(59,130,246,0.28),transparent_45%),radial-gradient(circle_at_85%_20%,rgba(244,63,94,0.2),transparent_50%),radial-gradient(circle_at_20%_85%,rgba(14,165,233,0.12),transparent_45%)]" />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[linear-gradient(140deg,rgba(7,10,18,0.98),rgba(3,6,12,0.96))]" />
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:120px_120px]" />
      <div className="absolute -top-56 left-0 h-96 w-96 rounded-full bg-blue-500/20 blur-[160px] z-0 pointer-events-none" />
      <div className="absolute -bottom-48 right-10 h-96 w-96 rounded-full bg-rose-500/20 blur-[160px] z-0 pointer-events-none" />

      <div className="relative z-10">
      <motion.nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${
          scrolled ? "bg-[#0b1120]/85 backdrop-blur-xl border-b border-white/5" : ""
        }`}
        initial={{ y: -90 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.02 }}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-slate-700 to-rose-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-blue-200/70">AEGIS-AI</p>
                <p className="text-lg font-semibold">{t('landing.tagline')}</p>
              </div>
            </motion.div>

            <div className="hidden md:flex items-center gap-8 text-sm text-slate-300">
              <button
                className="hover:text-white transition-colors"
                onClick={() => handleNavClick("command")}
              >
                {t('nav.command')}
              </button>
              <button
                className="hover:text-white transition-colors"
                onClick={() => handleNavClick("assurance")}
              >
                {t('nav.assurance')}
              </button>
              <button
                className="hover:text-white transition-colors"
                onClick={() => handleNavClick("operations")}
              >
                {t('nav.operations')}
              </button>
              <button
                className="hover:text-white transition-colors"
                onClick={() => handleNavClick("about")}
              >
                {t('nav.about')}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <div className="hidden md:flex">
                <LanguageSwitcher variant="landing" />
              </div>
              <Button
                variant="outline"
                className="hidden sm:inline-flex rounded-full border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
              >
                {t('nav.emergency')}
              </Button>
              <Button
                variant="ghost"
                className="hidden sm:inline-flex rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                onClick={() => navigate("/auth")}
              >
                {t('nav.initializeProfile')}
              </Button>
              <motion.button
                onClick={() => navigate("/auth")}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-4 sm:px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 font-semibold shadow-lg shadow-blue-500/30"
              >
                {t('nav.signIn')}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      <motion.section
        id="command"
        className="min-h-screen flex items-center justify-center px-4 pt-28 pb-16 relative scroll-mt-24"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          <motion.div
            className="space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-400/30 bg-blue-500/10 text-xs uppercase tracking-[0.35em] text-blue-200">
                Government Response Platform
              </div>
              <h1 className="text-4xl md:text-6xl font-semibold leading-tight">
                <span className="block bg-gradient-to-r from-blue-200 via-slate-200 to-rose-200 bg-clip-text text-transparent">
                  {t('landing.hero')}
                </span>
              </h1>
            </motion.div>

            <motion.p variants={itemVariants} className="text-lg text-slate-300 leading-relaxed max-w-xl">
              {t('landing.subhero')}
            </motion.p>

            <motion.div variants={itemVariants} className="grid gap-4 max-w-xl">
              {heroHighlights.map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="mt-1 h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-blue-200" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{item.title}</p>
                    <p className="text-sm text-slate-400">{item.description}</p>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
              <Button
                onClick={() => navigate("/auth")}
                className="px-8 py-6 bg-rose-600 hover:bg-rose-500 text-lg font-semibold shadow-lg shadow-rose-500/30 ring-1 ring-rose-300/40"
              >
                {t('landing.reportIncident')}
                <ArrowRight className="ml-2" />
              </Button>
              <Button
                variant="outline"
                className="px-8 py-6 border border-white/10 bg-white/5 text-lg font-semibold text-slate-200 hover:bg-white/10"
                onClick={() => navigate("/auth")}
              >
                {t('landing.getHelp')}
              </Button>
            </motion.div>

            <motion.div variants={itemVariants} className="grid sm:grid-cols-3 gap-4">
              {[
                { value: "24/7", label: "Emergency Ops" },
                { value: "AES-256", label: "Encryption" },
                { value: "POPIA", label: "Compliance" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-2xl font-semibold text-blue-200">{stat.value}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-widest">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            className="relative h-full min-h-[32rem]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 1 }}
          >
            <div className="relative w-full h-full rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-950/80 to-slate-900/40 backdrop-blur-xl overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,64,175,0.22),transparent_45%)]" />
              <div className="absolute top-6 left-6 right-6">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-slate-400">
                  <span>Operational Status</span>
                  <span className="text-emerald-300">Live</span>
                </div>
                <h3 className="mt-3 text-2xl font-semibold">National Response Pulse</h3>
              </div>
              <div className="absolute top-24 left-6 right-6 grid gap-4">
                {[
                  { title: "Operational Pulse", value: "98.7", label: "Risk detection accuracy", accent: "text-blue-200" },
                  { title: "Secure Relay", value: "12 ms", label: "Cross-agency routing", accent: "text-emerald-200" },
                  { title: "Emergency Queue", value: "41", label: "Cases awaiting response", accent: "text-rose-200" },
                ].map((card) => (
                  <motion.div
                    key={card.title}
                    className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-950/80 to-slate-900/50 px-5 py-4 shadow-lg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                  >
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{card.title}</p>
                    <div className="mt-2 flex items-end justify-between">
                      <span className={`text-3xl font-semibold ${card.accent}`}>{card.value}</span>
                      <span className="text-xs text-emerald-300">Live</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">{card.label}</p>
                  </motion.div>
                ))}
              </div>
              <motion.div
                className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full border border-rose-400/40 bg-rose-400/10 blur-[1px]"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        id="assurance"
        className="py-24 px-4 relative scroll-mt-24"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1 }}
        viewport={{ once: true }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.12),transparent_55%),radial-gradient(circle_at_70%_70%,rgba(244,63,94,0.12),transparent_55%)]" />
        <div className="max-w-6xl mx-auto relative">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">{t('landing.capabilities')}</h2>
            <p className="text-lg text-slate-400">{t('landing.capabilitiesSubtitle')}</p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="p-6 rounded-2xl bg-slate-950/70 border border-white/10 hover:border-blue-400/40 hover:-translate-y-1 transition-all duration-300 shadow-[0_20px_50px_rgba(2,6,23,0.55)] backdrop-blur"
              >
                <feature.icon className="w-8 h-8 text-blue-300 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        id="operations"
        className="py-24 px-4 relative scroll-mt-24"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1 }}
        viewport={{ once: true }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(14,165,233,0.12),transparent_55%)]" />
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.45fr_0.55fr] gap-10 items-center relative">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-blue-200/70">Workflow Intelligence</p>
            <h2 className="text-3xl md:text-4xl font-semibold">{t('landing.cta.title')}</h2>
            <p className="text-lg text-slate-400">
              {t('landing.cta.subtitle')}
            </p>
          </div>
          <div className="grid gap-4">
            {workflowSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 flex items-start justify-between gap-6"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Step {index + 1}</p>
                  <h3 className="text-lg font-semibold mt-2">{step.title}</h3>
                  <p className="text-sm text-slate-400 mt-2">{step.description}</p>
                </div>
                <div className="text-xs text-emerald-300 uppercase tracking-[0.3em] whitespace-nowrap">
                  {step.metric}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section
        id="about"
        className="py-24 px-4 scroll-mt-24 relative"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1 }}
        viewport={{ once: true }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(59,130,246,0.22),transparent_60%),radial-gradient(circle_at_70%_80%,rgba(244,63,94,0.18),transparent_55%)]" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-950/80 to-slate-900/40 px-8 py-12 shadow-[0_30px_80px_rgba(2,8,23,0.65)]">
            <p className="text-xs uppercase tracking-[0.4em] text-blue-200/70">About AEGIS-AI</p>
            <h2 className="text-3xl md:text-4xl font-semibold mt-4 mb-6 text-white">
              {t('landing.cta.title')}
            </h2>
            <p className="text-lg text-slate-200/80 mb-10">
              {t('landing.cta.subtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                onClick={() => navigate("/auth")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="px-10 py-4 bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 rounded-full font-semibold text-lg shadow-lg shadow-blue-500/30 inline-flex items-center gap-2"
              >
                {t('landing.cta.button')}
                <ArrowRight className="w-5 h-5" />
              </motion.button>
              <motion.button
                onClick={() => navigate("/impact")}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                className="px-10 py-4 border border-white/15 bg-white/5 hover:bg-white/10 rounded-full font-semibold text-lg text-slate-200 inline-flex items-center gap-2 transition-all"
              >
                View Impact Data
                <TrendingUp className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.section>

      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-4 text-slate-500 text-sm">
          <div>© 2026 AEGIS-AI Platform. All rights reserved.</div>
          <div className="flex gap-6">
            <button className="hover:text-white transition-colors">Privacy</button>
            <button className="hover:text-white transition-colors">Terms</button>
            <button className="hover:text-white transition-colors">Contact</button>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default LandingPage;
