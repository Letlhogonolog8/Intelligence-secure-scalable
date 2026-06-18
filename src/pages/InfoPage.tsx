import React, { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, CheckCircle2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AegisLogo } from "@/components/AegisLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { CRISIS_LINE_DISPLAY, CRISIS_LINE_TEL } from "@/lib/crisisContacts";
import { getMarketingPage } from "@/data/marketingContent";

const InfoPage: React.FC = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const content = getMarketingPage(slug);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [slug]);

  if (!content) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a18] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a18]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <button
            className="flex items-center gap-2.5"
            onClick={() => navigate("/")}
          >
            <AegisLogo size={32} />
            <span className="text-lg font-bold tracking-tight">AEGIS-AI</span>
          </button>
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="compact" />
            <Button
              className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 font-semibold text-white shadow-lg shadow-violet-700/30 hover:opacity-95"
              onClick={() => navigate("/auth")}
            >
              Get Help Now
            </Button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="relative overflow-hidden py-16 sm:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_10%,rgba(168,85,247,0.28),transparent_50%),linear-gradient(160deg,#0a0a18,#140a28_60%,#0a0a18)]" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate("/")}
            className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-violet-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {content.title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-300">
            {content.subtitle}
          </p>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
        {/* Pricing tiers */}
        {content.pricing && (
          <div className="grid gap-6 md:grid-cols-3">
            {content.pricing.map((tier) => (
              <div
                key={tier.name}
                className={
                  tier.highlight
                    ? "rounded-3xl border border-violet-400/40 bg-violet-500/10 p-6 shadow-xl shadow-violet-900/30"
                    : "rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                }
              >
                <h3 className="text-sm font-semibold uppercase tracking-wider text-violet-300">
                  {tier.name}
                </h3>
                <p className="mt-2 text-3xl font-extrabold">{tier.price}</p>
                <p className="mt-1 text-sm text-slate-400">{tier.tagline}</p>
                <ul className="mt-5 space-y-2.5">
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-slate-200"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-6 w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold hover:opacity-95"
                  onClick={() => navigate("/auth")}
                >
                  {tier.cta}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Sections */}
        {content.sections && (
          <div className="space-y-6">
            {content.sections.map((section) => (
              <section
                key={section.heading}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <h2 className="text-lg font-semibold text-white">
                  {section.heading}
                </h2>
                {section.body && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {section.body}
                  </p>
                )}
                {section.bullets && (
                  <ul className="mt-3 space-y-2">
                    {section.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 text-sm text-slate-300"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}

        {/* FAQs */}
        {content.faqs && (
          <div className="space-y-4">
            {content.faqs.map((faq) => (
              <details
                key={faq.q}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-white marker:hidden">
                  {faq.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        )}

        {/* Help banner */}
        <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-3xl border border-violet-400/25 bg-violet-500/10 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-base font-semibold text-white">
              Need help right now?
            </p>
            <p className="mt-1 text-sm text-slate-300">
              You are not alone. Reach out any time — in any language.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={CRISIS_LINE_TEL}>
              <Button
                variant="outline"
                className="rounded-full border-white/20 bg-white/5 font-semibold text-white hover:bg-white/10"
              >
                <Phone className="mr-2 h-4 w-4" />
                Call {CRISIS_LINE_DISPLAY}
              </Button>
            </a>
            <Button
              className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold hover:opacity-95"
              onClick={() => navigate("/auth")}
            >
              Get Help Now
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#070710] py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} AEGIS-AI. All rights reserved.</p>
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            POPIA-aligned · End-to-end encrypted
          </div>
        </div>
      </footer>
    </div>
  );
};

export default InfoPage;
