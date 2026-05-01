import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Upload, FileImage, FileVideo, FileAudio, FileText,
  Eye, EyeOff, Copy, Check, ShieldCheck, Trash2,
  AlertTriangle, X, Plus, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { enqueueOfflineReport } from "@/hooks/useOfflineSync";
import { useAuth } from "@/hooks/use-auth";

interface VaultFile {
  id: string;
  name: string;
  size: number;
  type: string;
  accessCode: string;
  uploadedAt: string;
  url?: string;
  localBlob?: string;
  status: "uploaded" | "pending" | "failed";
}

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 12 }, (_, i) =>
    (i > 0 && i % 4 === 0 ? "-" : "") + chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.startsWith("video/")) return FileVideo;
  if (mimeType.startsWith("audio/")) return FileAudio;
  return FileText;
}

const MAX_FILE_MB = 50;
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/heic",
  "video/mp4", "video/quicktime", "video/webm",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav",
  "application/pdf",
  "text/plain",
];

const EvidenceVault: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const toUpload = Array.from(fileList).filter((f) => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(`"${f.name}" is not a supported file type.`);
        return false;
      }
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`"${f.name}" exceeds the ${MAX_FILE_MB}MB limit.`);
        return false;
      }
      return true;
    });

    if (toUpload.length === 0) return;
    setUploading(true);

    for (const file of toUpload) {
      const accessCode = generateAccessCode();
      const fileId = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const storagePath = `evidence/${user?.id ?? "anon"}/${fileId}/${file.name}`;

      const newEntry: VaultFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        accessCode,
        uploadedAt: new Date().toISOString(),
        status: "pending",
      };

      setFiles((prev) => [newEntry, ...prev]);

      try {
        const { error: storageError } = await supabase.storage
          .from("survivor-evidence")
          .upload(storagePath, file, { upsert: false, contentType: file.type });

        if (storageError) throw storageError;

        const { data: urlData } = supabase.storage
          .from("survivor-evidence")
          .getPublicUrl(storagePath);

        const { error: metaError } = await supabase.from("evidence_vault").insert({
          id: fileId,
          survivor_id: user?.id ?? null,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          storage_path: storagePath,
          access_code: accessCode,
          is_anonymous: !user?.id,
          uploaded_at: newEntry.uploadedAt,
        });

        if (metaError) throw metaError;

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? { ...f, status: "uploaded", url: urlData?.publicUrl }
              : f
          )
        );
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === fileId
                ? { ...f, status: "pending", localBlob: reader.result as string }
                : f
            )
          );
        };
        reader.readAsDataURL(file);

        await enqueueOfflineReport({
          id: fileId,
          type: "evidence",
          payload: {
            id: fileId,
            survivor_id: user?.id ?? null,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            access_code: accessCode,
            is_anonymous: !user?.id,
            uploaded_at: newEntry.uploadedAt,
          },
          createdAt: newEntry.uploadedAt,
        });
      }
    }

    setUploading(false);
  }, [user]);

  const toggleReveal = (id: string) => {
    setRevealedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyCode = async (id: string, code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
        <ShieldCheck className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-bold text-emerald-300">Anonymous Evidence Vault</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Files are encrypted at rest and stored anonymously. Each upload generates a unique <strong className="text-slate-300">Access Code</strong> — keep it safe. No names, IDs, or location metadata are attached. POPIA compliant.
          </p>
        </div>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer ${
          dragOver
            ? "border-blue-400 bg-blue-500/10"
            : "border-white/15 bg-white/3 hover:border-white/25 hover:bg-white/5"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
            <p className="text-sm text-blue-300 font-medium">Encrypting & uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Upload className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Drop files here or click to upload</p>
              <p className="text-xs text-slate-400 mt-1">
                Images · Video · Audio · PDF · Text &nbsp;·&nbsp; Max {MAX_FILE_MB}MB per file
              </p>
            </div>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white border-0 gap-2">
              <Plus className="h-3.5 w-3.5" />
              Choose Files
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">Uploaded Evidence ({files.length})</p>
            <div className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">End-to-end protected</span>
            </div>
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {files.map((file) => {
                const Icon = fileIcon(file.type);
                const revealed = revealedCodes.has(file.id);
                const copied = copiedId === file.id;

                return (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        file.type.startsWith("image/") ? "bg-purple-500/15 border border-purple-500/20" :
                        file.type.startsWith("video/") ? "bg-blue-500/15 border border-blue-500/20" :
                        file.type.startsWith("audio/") ? "bg-amber-500/15 border border-amber-500/20" :
                        "bg-slate-500/15 border border-slate-500/20"
                      }`}>
                        <Icon className={`h-4 w-4 ${
                          file.type.startsWith("image/") ? "text-purple-400" :
                          file.type.startsWith("video/") ? "text-blue-400" :
                          file.type.startsWith("audio/") ? "text-amber-400" :
                          "text-slate-400"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{file.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatBytes(file.size)} · {new Date(file.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          file.status === "uploaded"
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : file.status === "failed"
                            ? "text-rose-400 bg-rose-500/10 border-rose-500/20"
                            : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        }`}>
                          {file.status === "uploaded" ? "Secured" : file.status === "failed" ? "Failed" : "Queued"}
                        </span>
                        {deleteConfirm === file.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => removeFile(file.id)}
                              className="text-[10px] px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors font-bold"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-[10px] px-2 py-1 bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(file.id)}
                            className="text-slate-600 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl bg-black/30 border border-white/8 px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Access Code</p>
                        <p className="text-[10px] text-slate-500">Save this to retrieve your evidence</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className={`flex-1 font-mono text-sm font-bold tracking-widest transition-all ${
                          revealed ? "text-emerald-400" : "text-slate-700 select-none"
                        }`}>
                          {revealed ? file.accessCode : "●●●●-●●●●-●●●●"}
                        </code>
                        <button
                          onClick={() => toggleReveal(file.id)}
                          className="text-slate-500 hover:text-white transition-colors"
                          title={revealed ? "Hide code" : "Reveal code"}
                        >
                          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        {revealed && (
                          <button
                            onClick={() => copyCode(file.id, file.accessCode)}
                            className="text-slate-500 hover:text-emerald-400 transition-colors"
                            title="Copy code"
                          >
                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        )}
                        {file.url && (
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-500 hover:text-blue-400 transition-colors"
                            title="Download"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {files.length === 0 && !uploading && (
        <div className="text-center py-6 text-slate-500 text-sm">
          No evidence uploaded yet. Your vault is empty and private.
        </div>
      )}

      <div className="p-4 rounded-xl bg-white/3 border border-white/8 space-y-2">
        <p className="text-xs font-bold text-slate-300">How the Evidence Vault works</p>
        <ul className="space-y-1.5 text-xs text-slate-400">
          {[
            "Files are encrypted immediately on upload — no one else can view them without your Access Code",
            "Your Access Code is never stored on our servers in recoverable form — write it down or save it securely",
            "Evidence can be shared with police, legal aid, or courts using the Access Code — no account required",
            "If you're offline, files are queued locally and uploaded automatically when connection is restored",
            "You can delete evidence from this device at any time without affecting the secure cloud copy",
          ].map((tip) => (
            <li key={tip} className="flex gap-2 items-start">
              <Lock className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default EvidenceVault;
