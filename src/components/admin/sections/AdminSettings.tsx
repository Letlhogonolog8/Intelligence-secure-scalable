import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Bell,
  Brain,
  Info,
} from "lucide-react";

/**
 * Settings — platform, security, notification and AI controls. These are
 * UI-first: toggles hold local state and an honest note flags that persistence
 * lands when the settings backend is wired. No control silently pretends to
 * save server-side.
 */

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-left"
    >
      <span>
        <span className="block text-sm font-semibold text-white">{label}</span>
        {hint ? (
          <span className="block text-xs text-slate-400">{hint}</span>
        ) : null}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-emerald-500" : "bg-slate-600"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </span>
    </button>
  );
}

function SettingCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-violet-300" />
        <h2 className="text-lg font-black text-white">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

export default function AdminSettings() {
  const [platformName, setPlatformName] = useState("AEGIS-AI");
  const [defaultLanguage, setDefaultLanguage] = useState("English");
  const [sessionTimeout, setSessionTimeout] = useState("30");

  const [mfa, setMfa] = useState(true);
  const [deviceVerification, setDeviceVerification] = useState(true);
  const [strongPasswords, setStrongPasswords] = useState(true);

  const [sms, setSms] = useState(true);
  const [email, setEmail] = useState(true);
  const [whatsapp, setWhatsapp] = useState(true);
  const [push, setPush] = useState(true);

  const [riskScoring, setRiskScoring] = useState(true);
  const [translation, setTranslation] = useState(true);
  const [voice, setVoice] = useState(true);
  const [sentiment, setSentiment] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
        <p className="text-sm text-sky-100">
          These controls are presentation-ready. Values apply once the settings
          persistence backend is connected — nothing here silently saves
          server-side yet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SettingCard title="Platform" icon={SettingsIcon}>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Organization name</Label>
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="border-white/10 bg-slate-950/60 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Default language</Label>
            <Input
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              className="border-white/10 bg-slate-950/60 text-white"
            />
          </div>
          <p className="text-xs text-slate-500">
            Logo and theme are managed via the brand assets in the app shell.
          </p>
        </SettingCard>

        <SettingCard title="Security" icon={ShieldCheck}>
          <Toggle
            label="Multi-factor authentication"
            hint="Require MFA for privileged roles"
            value={mfa}
            onChange={setMfa}
          />
          <Toggle
            label="Strong password policy"
            hint="Min length, complexity, rotation"
            value={strongPasswords}
            onChange={setStrongPasswords}
          />
          <Toggle
            label="Device verification"
            hint="Verify new devices on sign-in"
            value={deviceVerification}
            onChange={setDeviceVerification}
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">
              Session timeout (minutes)
            </Label>
            <Input
              type="number"
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(e.target.value)}
              className="border-white/10 bg-slate-950/60 text-white"
            />
          </div>
        </SettingCard>

        <SettingCard title="Notifications" icon={Bell}>
          <Toggle label="SMS" value={sms} onChange={setSms} />
          <Toggle label="Email" value={email} onChange={setEmail} />
          <Toggle label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
          <Toggle label="Push notifications" value={push} onChange={setPush} />
        </SettingCard>

        <SettingCard title="AI" icon={Brain}>
          <Toggle
            label="Risk scoring"
            hint="AI triage on incoming reports"
            value={riskScoring}
            onChange={setRiskScoring}
          />
          <Toggle
            label="Translation engine"
            hint="Voice & text translation"
            value={translation}
            onChange={setTranslation}
          />
          <Toggle
            label="Voice processing"
            hint="Transcription of voice notes"
            value={voice}
            onChange={setVoice}
          />
          <Toggle
            label="Sentiment analysis"
            hint="Distress detection in messages"
            value={sentiment}
            onChange={setSentiment}
          />
        </SettingCard>
      </div>
    </div>
  );
}
