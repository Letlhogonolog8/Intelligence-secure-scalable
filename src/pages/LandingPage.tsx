import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock3,
  Lock,
  Menu,
  Shield,
  Siren,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  const navItems = useMemo(
    () => [
      { id: "hero", label: t("nav.command", "Command") },
      { id: "capabilities", label: t("nav.assurance", "Assurance") },
      { id: "workflow", label: t("nav.operations", "Operations") },
      { id: "about", label: t("nav.about", "About") },
    ],
    [t],
  );

  const handleNavClick = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    setMobileMenuOpen(false);
    if (!section) {
      return;
    }
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const features = [
    {
      icon: Shield,
      title: t("landing.features.security.title", "Command-Grade Security"),
      description: t(
        "landing.features.security.desc",
        "Zero-trust access, encrypted audit trails, POPIA-aligned governance.",
      ),
    },
    {
      icon: Brain,
      title: t("landing.features.ai.title", "AI Risk Orchestration"),
      description: t(
        "landing.features.ai.desc",
        "Real-time prioritization with NLP escalation and adaptive scoring.",
      ),
    },
    {
      icon: Siren,
      title: t("landing.features.emergency.title", "Emergency Response"),
      description: t(
        "landing.features.emergency.desc",
        "Critical alerts routed to police, NGOs, and counselors within seconds.",
      ),
    },
    {
      icon: Lock,
      title: t("landing.features.survivor.title", "Survivor Safety Layer"),
      description: t(
        "landing.features.survivor.desc",
        "Location encryption, secure profile vaults, trauma-informed access.",
      ),
    },
  ];

  const workflowSteps = [
    {
      title: "Verify & Triage",
      description:
        "Validate identity, classify risk, and prioritize response with AI-backed scoring.",
      metric: "SLA < 5 min",
      icon: Activity,
    },
    {
      title: "Coordinate Services",
      description:
        "Orchestrate police, legal, medical, and NGO response with secure handoffs.",
      metric: "12 ms relay",
      icon: Users,
    },
    {
      title: "Track Outcomes",
      description:
        "Maintain auditable case progress, survivor updates, and compliance checkpoints.",
      metric: "24/7 monitoring",
      icon: CheckCircle2,
    },
  ];

  const stats = [
    { value: "24/7", label: "Emergency Operations" },
    { value: "AES-256", label: "Encryption Standard" },
    { value: "POPIA", label: "Compliance by Design" },
  ];

  const trustPoints = [
    "Role-based access with auditable handoff controls",
    "Encrypted case routing across response stakeholders",
    "Trauma-informed survivor support workflows",
  ];

  const pulseRows = [
    {
      label: "Risk Detection Accuracy",
      value: "98.7%",
      tone: "text-emerald-200",
    },
    { label: "Secure Agency Relay", value: "12 ms", tone: "text-sky-200" },
    { label: "Active Emergency Queue", value: "41", tone: "text-rose-200" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.15 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55 } },
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070d17] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_18%,rgba(56,189,248,0.18),transparent_40%),radial-gradient(circle_at_84%_16%,rgba(244,63,94,0.16),transparent_42%),linear-gradient(145deg,#070d17_0%,#0a1323_60%,#060a13_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:128px_128px]" />

      <motion.nav
        className={cn(
          "fixed top-0 z-50 w-full border-b transition-all duration-300",
          scrolled
            ? "border-white/10 bg-[#091223]/90 backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <button
            className="flex items-center gap-3 text-left"
            onClick={() => {
              setMobileMenuOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-blue-500 to-rose-500 shadow-lg shadow-sky-500/25">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-sky-200/70">
                AEGIS-AI
              </p>
              <p className="text-sm font-semibold leading-tight sm:text-base">
                {t("landing.tagline", "National Response Grid")}
              </p>
            </div>
          </button>

          <div className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                className="hover:text-white"
                onClick={() => handleNavClick(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <LanguageSwitcher variant="compact" />
            <Button
              variant="outline"
              className="border-rose-400/45 bg-transparent text-rose-200 hover:bg-rose-500/10"
              onClick={openAuth}
            >
              {t("nav.emergency", "Emergency")}
            </Button>
            <Button
              className="bg-gradient-to-r from-sky-500 via-blue-600 to-rose-500 px-4 font-semibold text-white shadow-lg shadow-blue-600/30 hover:opacity-95"
              onClick={openAuth}
            >
              {t("nav.signIn", "Sign In")}
            </Button>
          </div>

          <button
            type="button"
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 md:hidden"
            onClick={() => setMobileMenuOpen((current) => !current)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#091223]/95 px-4 py-4 backdrop-blur-xl md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-4">
              <LanguageSwitcher variant="compact" />
              <div className="grid gap-2">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200"
                    onClick={() => handleNavClick(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="h-11 border-rose-400/45 bg-transparent text-rose-200 hover:bg-rose-500/10"
                  onClick={openAuth}
                >
                  {t("nav.emergency", "Emergency")}
                </Button>
                <Button
                  className="h-11 bg-gradient-to-r from-sky-500 via-blue-600 to-rose-500 font-semibold text-white"
                  onClick={openAuth}
                >
                  {t("nav.signIn", "Sign In")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.nav>

      <div className="relative z-10">
        <section
          id="hero"
          className="scroll-mt-28 px-4 pb-14 pt-32 sm:px-6 sm:pt-36 lg:px-8"
        >
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-7"
            >
              <motion.div
                variants={itemVariants}
                className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-400/10 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-sky-100"
              >
                Government Response Platform
              </motion.div>

              <motion.h1
                variants={itemVariants}
                className="max-w-2xl text-4xl font-semibold leading-[1.05] text-white sm:text-5xl lg:text-6xl"
              >
                <span className="bg-gradient-to-r from-sky-200 via-blue-100 to-rose-200 bg-clip-text text-transparent">
                  {t(
                    "landing.hero",
                    "Secure coordination for GBV emergency response",
                  )}
                </span>
              </motion.h1>

              <motion.p
                variants={itemVariants}
                className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg"
              >
                {t(
                  "landing.subhero",
                  "AEGIS-AI unifies survivor services, law enforcement, and policy intelligence with encrypted workflows, real-time escalation, and accountable governance.",
                )}
              </motion.p>

              <motion.div
                variants={itemVariants}
                className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
              >
                <Button
                  className="h-12 bg-rose-600 px-6 text-base font-semibold hover:bg-rose-500"
                  onClick={openAuth}
                >
                  {t("landing.reportIncident", "Report Incident")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-12 border-white/20 bg-white/5 px-6 text-base text-slate-100 hover:bg-white/10"
                  onClick={openAuth}
                >
                  {t("landing.getHelp", "Get Help Now")}
                </Button>
                <Button
                  variant="ghost"
                  className="h-12 justify-start px-0 text-base font-semibold text-sky-200 hover:bg-transparent hover:text-sky-100"
                  onClick={() => navigate("/impact")}
                >
                  View Impact Data
                  <TrendingUp className="ml-2 h-4 w-4" />
                </Button>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="grid gap-3 sm:grid-cols-3"
              >
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 shadow-[0_18px_40px_rgba(2,6,23,0.35)]"
                  >
                    <p className="text-2xl font-semibold text-sky-200">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="grid gap-3 sm:grid-cols-3"
              >
                {trustPoints.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <p className="text-sm text-slate-300">{point}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="relative"
            >
              <div className="absolute -inset-3 rounded-[32px] bg-gradient-to-br from-sky-500/10 via-transparent to-rose-500/10 blur-2xl" />
              <div className="relative rounded-[30px] border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950/80 p-6 shadow-[0_24px_80px_rgba(2,6,23,0.6)] backdrop-blur-xl sm:p-7">
                <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Operational Pulse
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Live coordination status
                    </h2>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-full border border-emerald-300/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                    Live
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {pulseRows.map((row) => (
                    <div
                      key={row.label}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        {row.label}
                      </p>
                      <p
                        className={cn("mt-2 text-3xl font-semibold", row.tone)}
                      >
                        {row.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                      <Clock3 className="h-5 w-5 text-sky-200" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Response readiness
                      </p>
                      <p className="text-sm text-slate-400">
                        Cross-agency routing remains available with monitored
                        audit coverage.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-slate-800/80">
                    <div className="h-full w-[98%] rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-blue-500" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="px-4 pb-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-3 rounded-[30px] border border-white/10 bg-slate-950/40 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:p-5">
              {[
                {
                  title: "Rapid escalation",
                  detail: "Incident intake to verified triage in minutes",
                },
                {
                  title: "Protected data flow",
                  detail: "Encrypted transfers across every responder role",
                },
                {
                  title: "Governance visibility",
                  detail: "Audit checkpoints embedded in each workflow step",
                },
                {
                  title: "Survivor-first design",
                  detail:
                    "Access designed to reduce friction and preserve trust",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <p className="text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="capabilities"
          className="scroll-mt-28 px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-12 text-center"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">
                Assurance Layer
              </p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
                {t("landing.capabilities", "Critical Capabilities")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-400">
                {t(
                  "landing.capabilitiesSubtitle",
                  "Operational layers built for safety, urgency, and trust.",
                )}
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {features.map((feature) => (
                <motion.div
                  key={feature.title}
                  variants={itemVariants}
                  className="rounded-[28px] border border-white/10 bg-slate-950/70 p-7 shadow-[0_20px_50px_rgba(2,6,23,0.5)] backdrop-blur"
                >
                  <div className="mb-4 inline-flex rounded-2xl border border-white/10 bg-white/5 p-3">
                    <feature.icon className="h-5 w-5 text-sky-200" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section
          id="workflow"
          className="scroll-mt-28 px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto grid max-w-6xl gap-10 rounded-[32px] border border-white/10 bg-slate-950/45 p-6 lg:grid-cols-[0.45fr_0.55fr] lg:items-start lg:p-8">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-5"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">
                Workflow Intelligence
              </p>
              <h2 className="text-3xl font-semibold sm:text-4xl">
                {t("landing.cta.title", "Activate trusted response workflows")}
              </h2>
              <p className="text-lg text-slate-400">
                {t(
                  "landing.cta.subtitle",
                  "Purpose-built to coordinate GBV emergency response with accountable, AI-driven intelligence.",
                )}
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="space-y-4"
            >
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step.title}
                  variants={itemVariants}
                  className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/5 p-5 sm:flex-row sm:items-start"
                >
                  <div className="flex items-start gap-4 sm:flex-1">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70">
                      <step.icon className="h-5 w-5 text-sky-200" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                        Step {index + 1}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-white">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  <p className="w-fit rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-200">
                    {step.metric}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <section id="about" className="scroll-mt-28 px-4 pb-20 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-5xl rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-950/90 to-slate-900/70 p-8 text-center shadow-[0_30px_80px_rgba(2,8,23,0.65)] sm:p-12"
          >
            <p className="text-xs uppercase tracking-[0.35em] text-sky-200/70">
              About AEGIS-AI
            </p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
              Response infrastructure you can trust
            </h2>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-slate-300">
              AEGIS-AI is designed for secure, role-based, trauma-informed
              response operations with measurable accountability.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                className="h-12 bg-gradient-to-r from-sky-500 via-blue-600 to-rose-500 px-7 text-base font-semibold"
                onClick={openAuth}
              >
                {t("landing.cta.button", "Access Response Console")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-12 border-white/20 bg-white/5 px-7 text-base font-semibold text-slate-100 hover:bg-white/10"
                onClick={() => navigate("/impact")}
              >
                View Impact Data
                <TrendingUp className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </section>

        <footer className="border-t border-white/10 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
            <p>
              &copy; 2026 AEGIS-AI Platform. POPIA-aligned. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <a
                className="hover:text-white"
                href="/impact"
                onClick={(event) => {
                  event.preventDefault();
                  navigate("/impact");
                }}
              >
                Impact
              </a>
              <a
                className="hover:text-white"
                href="https://www.justice.gov.za/inforeg/"
                target="_blank"
                rel="noreferrer"
              >
                Privacy (POPIA)
              </a>
              <a className="hover:text-white" href="mailto:dpo@aegis-ai.co.za">
                Data Protection Officer
              </a>
              <a
                className="hover:text-white"
                href="mailto:security@aegis-ai.co.za"
              >
                Report a Vulnerability
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;
