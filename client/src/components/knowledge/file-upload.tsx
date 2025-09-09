import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FileUploadProps {
  agentId: string;
  onUploadComplete?: () => void;
}

interface FileWithStatus {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
}

export default function FileUpload({ agentId, onUploadComplete }: FileUploadProps) {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [url, setUrl] = useState("");
  const [submittingUrl, setSubmittingUrl] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: "pending" as const,
      progress: 0,
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const uploadFile = async (fileWithStatus: FileWithStatus, index: number) => {
    try {
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: "uploading", progress: 0 } : f
      ));

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setFiles(prev => prev.map((f, i) => 
          i === index && f.status === "uploading" 
            ? { ...f, progress: Math.min(f.progress + 10, 90) } 
            : f
        ));
      }, 100);

      const result = await api.uploadKnowledgeDocument(agentId, fileWithStatus.file);

      clearInterval(progressInterval);
      
      setFiles(prev => prev.map((f, i) => 
        i === index ? { ...f, status: "success", progress: 100 } : f
      ));

      toast.success("Upload successful", {
        description: `${fileWithStatus.file.name} has been processed and added to the knowledge base.`,
      });

      // Refresh knowledge list for this agent so the UI shows the newly added document
      try {
        await queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
      } catch (e) {
        // ignore invalidate errors
      }

      onUploadComplete?.();
    } catch (error) {
      setFiles(prev => prev.map((f, i) => 
        i === index ? { 
          ...f, 
          status: "error", 
          progress: 0,
          error: error instanceof Error ? error.message : "Upload failed"
        } : f
      ));

      toast.error('Upload failed', {
        description: `Failed to upload ${fileWithStatus.file.name}. Please try again.`,
      });
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAll = () => {
    files.forEach((fileWithStatus, index) => {
      if (fileWithStatus.status === "pending") {
        uploadFile(fileWithStatus, index);
      }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="url" className="w-full">
        <TabsList className="w-full grid grid-cols-2 mb-2">
          <TabsTrigger value="url" data-testid="tab-url">From URL</TabsTrigger>
          <TabsTrigger value="file" data-testid="tab-file">From File</TabsTrigger>
        </TabsList>
        <TabsContent value="url">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm font-medium">Add from Website URL</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/article"
                  className="flex-1 border rounded-md px-3 py-2 bg-card text-sm"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  data-testid="input-knowledge-url"
                />
                <Button
                  disabled={!url || submittingUrl}
                  onClick={async () => {
                    try {
                      setSubmittingUrl(true);
                      const doc = await api.uploadKnowledgeFromUrl(agentId, url);
                      toast.success("URL processed", { description: doc.filename });
                      setUrl("");

                      // Refresh knowledge list for this agent so the UI shows the newly added document
                      try {
                        await queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
                      } catch (e) {
                        // ignore invalidate errors
                      }

                      onUploadComplete?.();
                    } catch (e) {
                      toast.error("Failed to ingest URL", { description: (e as Error).message });
                    } finally {
                      setSubmittingUrl(false);
                    }
                  }}
                  data-testid="button-submit-knowledge-url"
                >
                  {submittingUrl ? "Adding..." : "Add"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">We'll fetch the page content, extract readable text, summarize, and embed it.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="file">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              isDragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            )}
            data-testid="dropzone-file-upload"
          >
            <input {...getInputProps()} />
            <div className="mb-4">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {isDragActive 
                ? "Drop files here..." 
                : "Drag and drop files here or click to upload"
              }
            </p>
            <p className="text-xs text-muted-foreground">
              Supports PDF, DOCX, TXT, XLSX (Excel) up to 10MB
            </p>
            <Button 
              type="button" 
              className="mt-4"
              data-testid="button-choose-files"
            >
              Choose Files
            </Button>
          </div>
          {files.length > 0 && (
            <div className="space-y-2 mt-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Files to upload</h4>
                <Button 
                  onClick={uploadAll}
                  disabled={!files.some(f => f.status === "pending")}
                  data-testid="button-upload-all"
                >
                  Upload All
                </Button>
              </div>
              {files.map((fileWithStatus, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <File className="w-8 h-8 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" data-testid={`text-filename-${index}`}>{fileWithStatus.file.name}</p>
                        <p className="text-sm text-muted-foreground">{formatFileSize(fileWithStatus.file.size)}</p>
                        {fileWithStatus.status === "uploading" && (
                          <Progress value={fileWithStatus.progress} className="mt-2" />
                        )}
                        {fileWithStatus.status === "error" && fileWithStatus.error && (
                          <p className="text-sm text-destructive mt-1">{fileWithStatus.error}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {fileWithStatus.status === "success" && (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        )}
                        {fileWithStatus.status === "error" && (
                          <AlertCircle className="w-5 h-5 text-destructive" />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          disabled={fileWithStatus.status === "uploading"}
                          data-testid={`button-remove-file-${index}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
