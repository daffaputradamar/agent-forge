import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  const { toast } = useToast();

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

      toast({
        title: "Upload successful",
        description: `${fileWithStatus.file.name} has been processed and added to the knowledge base.`,
      });

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

      toast({
        title: "Upload failed",
        description: `Failed to upload ${fileWithStatus.file.name}. Please try again.`,
        variant: "destructive",
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
      {/* Drop Zone */}
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
          Supports PDF, DOCX, TXT files up to 10MB
        </p>
        <Button 
          type="button" 
          className="mt-4"
          data-testid="button-choose-files"
        >
          Choose Files
        </Button>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
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
                    <p className="font-medium truncate" data-testid={`text-filename-${index}`}>
                      {fileWithStatus.file.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(fileWithStatus.file.size)}
                    </p>
                    
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
    </div>
  );
}
