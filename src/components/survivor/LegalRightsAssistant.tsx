import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scale, MessageCircle } from "lucide-react";

const QUICK_PROMPTS = [
  "Can I apply for a protection order after hours?",
  "What evidence should I keep after an assault?",
  "How do I report intimidation by an offender?",
  "What are my rights during police statement intake?",
] as const;

const RESPONSES: Record<string, string> = {
  "Can I apply for a protection order after hours?": "Yes. You can seek urgent interim protection through SAPS and designated courts, with emergency support while waiting for full hearing scheduling.",
  "What evidence should I keep after an assault?": "Keep medical records, photos, threatening messages, witness contacts, and case reference numbers. Preserve original files where possible.",
  "How do I report intimidation by an offender?": "Report immediately to SAPS, include previous case references, and request that intimidation is appended to the active docket for escalation.",
  "What are my rights during police statement intake?": "You can request a support person, ask for clear translation, review your statement before signing, and receive a case number copy.",
};

const LegalRightsAssistant: React.FC = () => {
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  return (
    <Card className="border-white/15 bg-slate-950/65 p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
            <Scale className="h-4 w-4 text-indigo-300" />
          </div>
          <h3 className="text-white font-bold text-lg">AI Legal Rights Assistant</h3>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-indigo-300 border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 rounded-full">
          SA Law Guided
        </span>
      </div>

      <p className="text-sm text-slate-300 mb-4">
        Ask rights questions aligned to South African GBV legal procedures. Responses are guidance and should be validated with a legal professional.
      </p>

      <div className="grid gap-2 md:grid-cols-2">
        {QUICK_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            className="justify-start text-left h-auto py-2.5 border-white/10 bg-slate-900/50 hover:bg-indigo-500/10 hover:border-indigo-500/30"
            onClick={() => setSelectedPrompt(prompt)}
          >
            <MessageCircle className="h-3.5 w-3.5 mr-2 text-indigo-300 shrink-0" />
            <span className="text-xs whitespace-normal leading-relaxed">{prompt}</span>
          </Button>
        ))}
      </div>

      {selectedPrompt && (
        <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
          <p className="text-[11px] font-semibold text-indigo-200 mb-1">Selected question</p>
          <p className="text-sm text-white mb-3">{selectedPrompt}</p>
          <p className="text-sm text-slate-200 leading-relaxed">{RESPONSES[selectedPrompt]}</p>
        </div>
      )}
    </Card>
  );
};

export default LegalRightsAssistant;
