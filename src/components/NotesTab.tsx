import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Loader2, Sparkles, Eye, FileDown } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface NotesTabProps {
  uploadId: string;
  fileText: string;
  fileUrl: string;
  subjectName: string;
  accessToken: string;
  onPlanUpdated?: () => void;
}

export function NotesTab({ uploadId, fileText, fileUrl, subjectName, accessToken, onPlanUpdated }: NotesTabProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState<string[]>([]);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Support multiple files separated by "|||"
  const fileUrls = (fileUrl || "").split("|||").filter(Boolean);
  const firstFile = fileUrls[0] || "";
  const isPdf = firstFile.toLowerCase().endsWith(".pdf");
  const isImage = /\.(jpg|jpeg|png|webp)$/i.test(firstFile);
  const isViewable = isPdf || isImage;

  useEffect(() => {
    if (!firstFile || !isViewable) return;
    supabase.storage.from("notes").createSignedUrl(firstFile, 3600).then(({ data }) => {
      if (data?.signedUrl) setPdfUrl(data.signedUrl);
    });
  }, [firstFile, isViewable]);

  const generateSummary = async () => {
    if (aiSummary) return;
    setSummaryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("notes-summary", {
        body: { noteText: fileText?.slice(0, 15000), subjectName, fileUrl, uploadId },
      });
      if (error) throw error;
      setAiSummary(data?.summary ?? "No summary could be generated.");
    } catch {
      toast.error("Failed to generate summary. Try again.");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleUploadMore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${uploadId}/additional_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("notes").upload(path, file);
      if (uploadError) throw uploadError;

      const text = await file.text();
      setAdditionalNotes((prev) => [...prev, text.slice(0, 5000)]);

      const combined = (fileText || "") + "\n\n--- ADDITIONAL NOTES ---\n\n" + text.slice(0, 20000);
      await supabase.from("uploads").update({ file_text: combined.slice(0, 50000) }).eq("id", uploadId);

      toast.success("Notes uploaded! Your study plan will be updated.");
      setAiSummary(null);
      onPlanUpdated?.();
    } catch {
      toast.error("Failed to upload notes.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Summary Section */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">AI Topic Summary</h2>
          </div>
          {!aiSummary && (
            <Button size="sm" onClick={generateSummary} disabled={summaryLoading || !fileText}>
              {summaryLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {summaryLoading ? "Generating..." : "Generate Summary"}
            </Button>
          )}
        </div>
        {aiSummary ? (
          <div className="h-[400px] overflow-y-auto rounded-md border border-border/50 p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
              <ReactMarkdown>{aiSummary}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {fileText
              ? "Click 'Generate Summary' to get an AI-powered overview of your notes and key topics to study."
              : "No notes content available to summarise."}
          </p>
        )}
      </Card>

      {/* Original Notes - with PDF/Image viewer */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Your Notes</h2>
          </div>
          <div className="flex items-center gap-2">
            {isViewable && pdfUrl && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPdf(!showPdf)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  {showPdf ? "Show Text" : isPdf ? "View PDF" : "View Image"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                >
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download>
                    <FileDown className="h-4 w-4" />
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>

        {showPdf && pdfUrl ? (
          isPdf ? (
            <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
              <iframe
                src={pdfUrl}
                className="w-full h-[600px]"
                title="Notes PDF viewer"
              />
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden border border-border bg-muted/30 flex items-center justify-center p-4">
              <img src={pdfUrl} alt="Uploaded notes" className="max-w-full max-h-[600px] object-contain rounded" />
            </div>
          )
        ) : fileText ? (
          <div className="h-[300px] overflow-y-auto rounded-md border border-border/50 p-4">
            <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
              {fileText.slice(0, 10000)}
              {fileText.length > 10000 && "\n\n... (truncated)"}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No notes content extracted from your upload.</p>
        )}
      </Card>

      {/* Additional Notes */}
      {additionalNotes.length > 0 && (
        <Card className="glass-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Additional Notes</h2>
          <div className="space-y-4">
            {additionalNotes.map((note, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-4" />}
                <ScrollArea className="max-h-[200px]">
                  <pre className="text-sm text-foreground/80 whitespace-pre-wrap font-sans leading-relaxed">
                    {note}
                  </pre>
                </ScrollArea>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upload More */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Add More Notes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload additional study material to enrich your plan.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.docx,.doc,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleUploadMore}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Uploading..." : "Upload Notes"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
