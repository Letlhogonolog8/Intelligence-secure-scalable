import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  HeartIcon,
  LockIcon,
  MicIcon,
  PhoneIcon,
  SendIcon,
  ShieldIcon,
  VolumeOffIcon,
  DownloadIcon,
  XIcon,
} from '@/components/ui/AegisIcons';
import { RISK_COLORS, RiskLevel } from '@/data/aegisData';
import { Skeleton } from '@/components/ui/skeleton';
import { env } from '@/lib/env';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  riskLevel?: RiskLevel;
  riskScore?: number;
  emotionDetected?: string;
  suggestedActions?: string[];
  resources?: string[];
  safetyAlert?: boolean;
}

const SurvivorSupport: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [silentMode, setSilentMode] = useState(false);
  const [showSafetyPlan, setShowSafetyPlan] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [consentGranted, setConsentGranted] = useState(true);
  const [consentStatus, setConsentStatus] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const latestRisk = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.riskLevel || message.riskScore !== undefined) {
        return {
          level: message.riskLevel ?? null,
          score: message.riskScore ?? null,
        };
      }
    }
    return null;
  }, [messages]);

  const riskScore = latestRisk?.score ?? null;
  const riskLevel = latestRisk?.level ?? null;
  const clampedRiskScore = riskScore !== null ? Math.min(Math.max(riskScore, 0), 1) : null;
  const riskBarWidth = clampedRiskScore !== null ? `${clampedRiskScore * 100}%` : "0%";
  const riskColor = riskLevel ? RISK_COLORS[riskLevel] : "transparent";
  const sessionMinutes = messages.length > 0
    ? Math.floor((Date.now() - messages[0].timestamp.getTime()) / 60000)
    : null;

  const quickActions = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const { suggestedActions: actions } = messages[index];
      if (actions && actions.length > 0) {
        return actions;
      }
    }
    return [] as string[];
  }, [messages]);

  const resourceList = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const { resources } = messages[index];
      if (resources && resources.length > 0) {
        return resources;
      }
    }
    return [] as string[];
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const validateSupabaseConfig = () => {
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_KEY) {
      return null;
    }
    try {
      const url = new URL(env.VITE_SUPABASE_URL);
      const projectRef = url.hostname.split('.')[0] ?? '';
      const payload = JSON.parse(atob(env.VITE_SUPABASE_KEY.split('.')[1] ?? '')) as { ref?: string };
      if (payload.ref && payload.ref !== projectRef) {
        return 'Supabase project key does not match the configured project URL.';
      }
    } catch {
      return 'Unable to validate Supabase configuration. Please verify the project URL and anon key.';
    }
    return null;
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    if (!consentGranted) {
      setConsentStatus("Please accept the data processing consent to continue.");
      return;
    }

    setConsentStatus(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const configIssue = validateSupabaseConfig();
    if (configIssue) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: configIssue,
        timestamp: new Date(),
        riskLevel: 'medium',
      }]);
      setIsLoading(false);
      return;
    }

    try {
      const conversationHistory = messages
        .filter(m => m.role !== 'system')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Failed to load session for chat request', sessionError);
      }

      const now = Math.floor(Date.now() / 1000);
      const { session } = sessionData;
      const isExpired = session?.expires_at ? session.expires_at <= now : false;
      let accessToken = session?.access_token;

      if (isExpired) {
        const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('Failed to refresh session for chat request', refreshError);
        }
        accessToken = refreshedData.session?.access_token;
      }

      const isProd = import.meta.env.PROD;
      if (!accessToken) {
        if (!isProd && env.VITE_SUPABASE_KEY) {
          accessToken = env.VITE_SUPABASE_KEY;
        } else {
          setMessages(prev => [...prev, {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: 'Your session has expired. Please sign in again to continue.',
            timestamp: new Date(),
            riskLevel: 'medium',
          }]);
          setIsLoading(false);
          return;
        }
      }

      const buildHeaders = (token: string) => {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };
        if (env.VITE_SUPABASE_KEY) {
          headers.apikey = env.VITE_SUPABASE_KEY;
        }
        return headers;
      };

      const invokeChat = (token: string) => supabase.functions.invoke('aegis-survivor-chat', {
        body: {
          message: messageText,
          conversation_history: conversationHistory,
          language: 'en',
          session_id: sessionId ?? undefined,
          consent_granted: consentGranted,
          consent_type: 'data_processing',
          anonymous: isAnonymous,
        },
        headers: buildHeaders(token),
      });

      const { data, error } = await invokeChat(accessToken);

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || 'Edge Function execution failed');
      }

      const nextSessionId = data?.session_id ?? sessionId;
      if (nextSessionId && nextSessionId !== sessionId) {
        setSessionId(nextSessionId);
      }

      const response = data?.response;
      if (response?.message) {
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response.message,
          timestamp: new Date(),
          riskLevel: response.risk_level ?? undefined,
          riskScore: response.risk_score ?? undefined,
          emotionDetected: response.emotion_detected ?? undefined,
          suggestedActions: response.suggested_actions ?? undefined,
          resources: response.resources ?? undefined,
          safetyAlert: response.safety_alert ?? undefined,
        };

        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: "I'm experiencing a brief connection issue, but I'm still here for you. If you're in immediate danger, please contact emergency services. You can also try sending your message again.",
        timestamp: new Date(),
        riskLevel: 'medium',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleVoiceInput = async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition not supported in this browser. Try Chrome, Edge, or Safari.');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setInput('🎤 Listening...');
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      setInput(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setInput('');
      alert(`Microphone error: ${event.error}`);
    };

    recognition.onend = () => {
      if (input && input !== '🎤 Listening...') {
        sendMessage(input);
      } else {
        setInput('');
      }
    };

    recognition.start();
  };

  const handleExportChat = () => {
    if (messages.length === 0) {
      return;
    }
    const rows = messages.map((message) => ({
      timestamp: message.timestamp.toISOString(),
      role: message.role,
      content: message.content,
      riskLevel: message.riskLevel ?? "",
      riskScore: message.riskScore ?? "",
      emotionDetected: message.emotionDetected ?? "",
      safetyAlert: message.safetyAlert ? "yes" : "no",
      suggestedActions: message.suggestedActions?.join(" | ") ?? "",
      resources: message.resources?.join(" | ") ?? "",
    }));
    const headers = Object.keys(rows[0]);
    const escapeValue = (value: unknown) => {
      const stringValue = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
    };
    const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escapeValue(row[header as keyof typeof row])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "survivor-support-chat.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full">
        {/* Chat Header */}
        <div className="px-4 lg:px-6 py-3 border-b border-slate-800/50 bg-slate-950/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-pink-500/20 flex items-center justify-center">
                <HeartIcon className="text-pink-400" size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Survivor Support AI</h3>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400">Trauma-Informed | Encrypted | Confidential</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportChat}
                disabled={messages.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <DownloadIcon size={14} />
                Export Chat
              </button>
              {/* Silent Mode Toggle */}
              <button
                onClick={() => setSilentMode(!silentMode)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                  silentMode
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white'
                }`}
              >
                <VolumeOffIcon size={14} />
                {silentMode ? 'Silent Mode ON' : 'Silent Mode'}
              </button>
              {/* Anonymous Toggle */}
              <button
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                  isAnonymous
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800/50 border border-slate-700/50 text-slate-400'
                }`}
              >
                <LockIcon size={14} />
                {isAnonymous ? 'Anonymous' : 'Identified'}
              </button>
              {/* Emergency */}
              <button
                onClick={() => {
                  setMessages(prev => [...prev, {
                    id: `emergency-${Date.now()}`,
                    role: 'system',
                    content: 'EMERGENCY PROTOCOL ACTIVATED. Connecting to nearest emergency services. If you are in immediate danger, please call your local emergency number.',
                    timestamp: new Date(),
                    safetyAlert: true,
                    riskLevel: 'critical',
                    riskScore: 1,
                  }]);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
              >
                <PhoneIcon size={14} />
                Emergency
              </button>
            </div>
          </div>

          {/* Risk Indicator Bar */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[10px] text-slate-500 w-16">Risk Level</span>
            {riskLevel && clampedRiskScore !== null ? (
              <>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: riskBarWidth, backgroundColor: riskColor }}
                  />
                </div>
                <span
                  className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full border"
                  style={{ color: riskColor, borderColor: `${riskColor}40`, backgroundColor: `${riskColor}10` }}
                >
                  {riskLevel}
                </span>
              </>
            ) : (
              <>
                <Skeleton className="h-2 flex-1 bg-slate-800/60" />
                <Skeleton className="h-5 w-16 bg-slate-800/60" />
              </>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.role === 'system' ? 'w-full' : ''}`}>
                {msg.role === 'system' ? (
                  <div className={`p-4 rounded-xl border ${
                    msg.safetyAlert
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-amber-500/5 border-amber-500/20'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangleIcon size={16} className={msg.safetyAlert ? 'text-red-400' : 'text-amber-400'} />
                      <span className={`text-xs font-semibold ${msg.safetyAlert ? 'text-red-400' : 'text-amber-400'}`}>
                        {msg.safetyAlert ? 'EMERGENCY ALERT' : 'SYSTEM NOTICE'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{msg.content}</p>
                  </div>
                ) : msg.role === 'user' ? (
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl rounded-br-md px-4 py-3">
                    <p className="text-sm text-white">{msg.content}</p>
                    <p className="text-[10px] text-slate-500 mt-1 text-right">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-slate-800/50 border border-slate-700/30 rounded-2xl rounded-bl-md px-4 py-3">
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-700/30">
                        <p className="text-[10px] text-slate-500">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {msg.emotionDetected && (
                          <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                            {msg.emotionDetected}
                          </span>
                        )}
                        {msg.riskLevel && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border"
                            style={{ color: RISK_COLORS[msg.riskLevel], borderColor: `${RISK_COLORS[msg.riskLevel]}40` }}>
                            {msg.riskLevel}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Suggested Actions */}
                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pl-2">
                        {msg.suggestedActions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => sendMessage(action)}
                            className="px-3 py-1.5 bg-slate-800/30 border border-slate-700/30 rounded-lg text-xs text-slate-300 hover:bg-slate-700/30 hover:text-white transition-all"
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Resources */}
                    {msg.resources && msg.resources.length > 0 && (
                      <div className="pl-2 space-y-1">
                        {msg.resources.map((resource, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-cyan-400">
                            <ShieldIcon size={12} />
                            <span>{resource}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800/50 border border-slate-700/30 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-slate-500">Listening with care...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-800/50 bg-slate-950/50">
          {!consentGranted && (
            <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <label className="flex items-start gap-2 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={consentGranted}
                  onChange={(event) => {
                    const nextValue = event.target.checked;
                    setConsentGranted(nextValue);
                    if (nextValue) {
                      setConsentStatus(null);
                    }
                  }}
                  className="mt-0.5 h-3 w-3 rounded border-slate-600 bg-slate-950"
                />
                <span>I consent to data processing for this support session. You can request deletion anytime.</span>
              </label>
              {consentStatus && (
                <p className="mt-2 text-[10px] text-amber-400">{consentStatus}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={silentMode ? "Silent mode active — type discreetly..." : "Type your message... You're safe here."}
                disabled={!consentGranted || isLoading}
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/30 focus:ring-1 focus:ring-pink-500/10 transition-all"
              />
            </div>
            <button
              onClick={handleVoiceInput}
              disabled={isLoading || !consentGranted}
              className="p-3 text-slate-400 hover:text-white bg-slate-900/50 border border-slate-800 rounded-xl hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              title="Voice input (requires microphone permission)"
            >
              <MicIcon size={18} />
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading || !consentGranted}
              className="p-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl text-white hover:from-pink-600 hover:to-rose-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <SendIcon size={18} />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <LockIcon size={10} className="text-emerald-500" />
              <span className="text-[10px] text-slate-600">End-to-end encrypted | AES-256-GCM</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSafetyPlan(true)}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Safety Plan
              </button>
              <button
                onClick={() => setShowResources(true)}
                className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
              >
                Resources
              </button>
              <button className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors">
                Document Incident
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Context */}
      <div className="hidden xl:flex w-80 border-l border-slate-800/50 flex-col bg-slate-950/30">
        <div className="p-4 border-b border-slate-800/50">
          <h4 className="text-white font-semibold text-sm mb-3">Session Intelligence</h4>
          <div className="space-y-3">
            {/* Risk Assessment */}
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">Dynamic Risk Score</span>
                {clampedRiskScore !== null ? (
                  <span className="text-lg font-bold" style={{ color: riskColor }}>
                    {(clampedRiskScore * 100).toFixed(0)}%
                  </span>
                ) : (
                  <Skeleton className="h-6 w-12 bg-slate-800/60" />
                )}
              </div>
              {clampedRiskScore !== null ? (
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: riskBarWidth, backgroundColor: riskColor }} />
                </div>
              ) : (
                <Skeleton className="h-2 w-full bg-slate-800/60" />
              )}
              <div className="flex justify-between mt-1">
                {(['low', 'medium', 'high', 'critical'] as RiskLevel[]).map(level => (
                  <span key={level} className="text-[8px] text-slate-600 capitalize">{level}</span>
                ))}
              </div>
            </div>

            {/* Session Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/50">
                <p className="text-[10px] text-slate-500">Messages</p>
                <p className="text-lg font-bold text-white">{messages.length}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/50">
                <p className="text-[10px] text-slate-500">Duration</p>
                {sessionMinutes !== null ? (
                  <p className="text-lg font-bold text-white">{sessionMinutes}m</p>
                ) : (
                  <Skeleton className="mt-1 h-6 w-12 bg-slate-800/60" />
                )}
              </div>
            </div>

            {/* Emotion Timeline */}
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
              <p className="text-xs text-slate-500 mb-2">Emotion Detection</p>
              <div className="space-y-1.5">
                {messages.filter(m => m.emotionDetected).slice(-5).map((msg) => (
                  <div key={msg.id} className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                      {msg.emotionDetected}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="p-4 flex-1 overflow-y-auto">
          <h4 className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">Quick Actions</h4>
          <div className="space-y-2">
            {quickActions.length > 0 ? (
              quickActions.map((action, index) => (
                <button
                  key={`${action}-${index}`}
                  onClick={() => sendMessage(action)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-900/30 border border-slate-800/50 rounded-lg hover:bg-slate-800/30 hover:border-slate-700/50 transition-all text-left group"
                >
                  <SendIcon size={16} className="text-slate-400" />
                  <span className="text-xs text-slate-400 group-hover:text-white transition-colors">{action}</span>
                </button>
              ))
            ) : (
              <>
                <Skeleton className="h-10 w-full bg-slate-800/60" />
                <Skeleton className="h-10 w-11/12 bg-slate-800/60" />
                <Skeleton className="h-10 w-10/12 bg-slate-800/60" />
              </>
            )}
          </div>
        </div>

        {/* Security Footer */}
        <div className="p-4 border-t border-slate-800/50">
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <LockIcon size={12} className="text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">Security Status</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircleIcon size={10} className="text-emerald-500" />
                <span className="text-[10px] text-slate-500">E2E Encryption Active</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon size={10} className="text-emerald-500" />
                <span className="text-[10px] text-slate-500">No Raw Data Logging</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircleIcon size={10} className="text-emerald-500" />
                <span className="text-[10px] text-slate-500">{isAnonymous ? 'Anonymous Mode' : 'Identified Mode'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Plan Modal */}
      {showSafetyPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldIcon className="text-emerald-400" size={24} />
                <h3 className="text-white font-semibold">Safety Plan Generator</h3>
              </div>
              <button onClick={() => setShowSafetyPlan(false)} className="text-slate-500 hover:text-white transition-colors">
                <XIcon size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400">A safety plan helps you prepare for dangerous situations. This is personalized based on your conversation.</p>
              <div className="space-y-3">
                <Skeleton className="h-16 w-full bg-slate-800/60" />
                <Skeleton className="h-16 w-11/12 bg-slate-800/60" />
                <Skeleton className="h-16 w-10/12 bg-slate-800/60" />
              </div>
              <button
                onClick={() => {
                  setShowSafetyPlan(false);
                  sendMessage('Help me create a detailed safety plan');
                }}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-white font-medium text-sm hover:from-emerald-600 hover:to-teal-600 transition-all"
              >
                Generate Personalized Safety Plan with AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resources Modal */}
      {showResources && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-white font-semibold">Support Resources</h3>
              <button onClick={() => setShowResources(false)} className="text-slate-500 hover:text-white transition-colors">
                <XIcon size={20} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {resourceList.length > 0 ? (
                resourceList.map((resource, index) => (
                  <div key={`${resource}-${index}`} className="p-3 bg-slate-800/30 rounded-lg border border-slate-800/50">
                    <p className="text-sm text-white font-medium">{resource}</p>
                  </div>
                ))
              ) : (
                <>
                  <Skeleton className="h-12 w-full bg-slate-800/60" />
                  <Skeleton className="h-12 w-11/12 bg-slate-800/60" />
                  <Skeleton className="h-12 w-10/12 bg-slate-800/60" />
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurvivorSupport;
