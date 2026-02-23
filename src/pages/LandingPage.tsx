import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, Globe, Lock, Shield, Siren } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
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
      title: "Command-Grade Security",
      description: "Zero-trust access, encrypted audit trails, POPIA-aligned governance.",
    },
    {
      icon: Brain,
      title: "AI Risk Orchestration",
      description: "Real-time prioritization with NLP escalation and adaptive scoring.",
    },
    {
      icon: Siren,
      title: "Emergency Response",
      description: "Critical alerts routed to police, NGOs, and counselors within seconds.",
    },
    {
      icon: Lock,
      title: "Survivor Safety Layer",
      description: "Location encryption, secure profile vaults, trauma-informed access.",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7 } },
  };

  return (
    <div className="min-h-screen bg-[#0b1120] text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(30,64,175,0.35),transparent_48%),radial-gradient(circle_at_85%_10%,rgba(239,68,68,0.22),transparent_55%),radial-gradient(circle_at_20%_85%,rgba(148,163,184,0.18),transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(8,12,24,0.96),rgba(3,7,14,0.99))]" />
      <div className="absolute -top-56 left-0 h-96 w-96 rounded-full bg-blue-600/20 blur-[180px]" />
      <div className="absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-rose-500/15 blur-[180px]" />

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
                <p className="text-lg font-semibold">National Response Grid</p>
              </div>
            </motion.div>

            <div className="hidden md:flex items-center gap-8 text-sm text-slate-300">
              <button className="hover:text-white transition-colors">Command</button>
              <button className="hover:text-white transition-colors">Assurance</button>
              <button className="hover:text-white transition-colors">Operations</button>
              <button className="hover:text-white transition-colors">About</button>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="hidden md:inline-flex rounded-full border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              >
                <Globe className="w-4 h-4 mr-2" />
                English
              </Button>
              <Button
                variant="outline"
                className="hidden sm:inline-flex rounded-full border-rose-500/40 text-rose-200 hover:bg-rose-500/10"
              >
                Emergency
              </Button>
              <Button
                variant="ghost"
                className="hidden sm:inline-flex rounded-full border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                onClick={() => navigate("/auth")}
              >
                Initialize Profile
              </Button>
              <motion.button
                onClick={() => navigate("/auth")}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 font-semibold shadow-lg shadow-blue-500/30"
              >
                Sign In
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      <motion.section
        className="min-h-screen flex items-center justify-center px-4 pt-24 relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
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
                Secure coordination for
                <span className="block bg-gradient-to-r from-blue-200 via-slate-200 to-rose-200 bg-clip-text text-transparent">
                  GBV emergency response
                </span>
              </h1>
            </motion.div>

            <motion.p variants={itemVariants} className="text-lg text-slate-300 leading-relaxed max-w-xl">
              AEGIS-AI unifies survivor services, law enforcement, and policy intelligence with encrypted
              workflows, real-time escalation, and accountable governance.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
              <Button
                onClick={() => navigate("/auth")}
                className="px-8 py-6 bg-rose-600 hover:bg-rose-500 text-lg font-semibold shadow-lg shadow-rose-500/30 ring-1 ring-rose-300/40"
              >
                Report Incident
                <ArrowRight className="ml-2" />
              </Button>
              <Button
                variant="outline"
                className="px-8 py-6 border border-white/10 bg-white/5 text-lg font-semibold text-slate-200 hover:bg-white/10"
                onClick={() => navigate("/auth")}
              >
                Get Help Now
              </Button>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-3 gap-6 pt-2">
              {[
                { value: "24/7", label: "Emergency Ops" },
                { value: "AES-256", label: "Encryption" },
                { value: "POPIA", label: "Compliance" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-semibold text-blue-200">{stat.value}</div>
                  <div className="text-xs text-slate-400 uppercase tracking-widest">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>

          <motion.div
            className="relative h-full min-h-[30rem]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 1 }}
          >
            <div className="relative w-full h-full rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-950/80 to-slate-900/40 backdrop-blur-xl overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(30,64,175,0.2),transparent_45%)]" />
              <div className="absolute top-6 left-6 right-6 grid gap-4">
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
                className="absolute -right-10 -bottom-10 w-36 h-36 rounded-full border border-rose-400/40 bg-rose-400/10 blur-[1px]"
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
            </div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="py-24 px-4 relative"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1 }}
        viewport={{ once: true }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-semibold mb-4">Critical Capabilities</h2>
            <p className="text-lg text-slate-400">Operational layers built for safety, urgency, and trust.</p>
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
                className="p-6 rounded-2xl bg-slate-950/70 border border-white/10 hover:border-blue-400/40 transition-all shadow-[0_20px_50px_rgba(2,6,23,0.55)]"
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
        className="py-24 px-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 1 }}
        viewport={{ once: true }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-6">Activate trusted response workflows</h2>
          <p className="text-lg text-slate-400 mb-10">
            Authenticate by role, initialize compliant profiles, and orchestrate emergency response with
            accountable intelligence.
          </p>
          <motion.button
            onClick={() => navigate("/auth")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="px-10 py-4 bg-gradient-to-r from-blue-500 via-slate-700 to-rose-500 rounded-full font-semibold text-lg shadow-lg shadow-blue-500/30 inline-flex items-center gap-2"
          >
            Access Response Console
            <ArrowRight className="w-5 h-5" />
          </motion.button>
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
  );
};

export default LandingPage;
