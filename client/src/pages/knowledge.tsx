import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Upload, FileText, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { useAgents } from "@/hooks/use-agents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FileUpload from "@/components/knowledge/file-upload";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

export default function Knowledge() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  const { data: agents, isLoading: agentsLoading } = useAgents();

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["knowledge", selectedAgentId],
    queryFn: () => selectedAgentId ? api.getKnowledgeDocuments(selectedAgentId) : Promise.resolve([]),
    enabled: !!selectedAgentId,
  });

  const filteredDocuments = documents?.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Knowledge Base</h2>
            <p className="text-muted-foreground">
              Manage knowledge documents for your agents
            </p>
          </div>
          <Button
            onClick={() => setShowUpload(true)}
            disabled={!selectedAgentId}
            data-testid="button-upload-knowledge"
          >
            <Upload className="mr-2 w-4 h-4" />
            Upload Documents
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <Select
            value={selectedAgentId}
            onValueChange={setSelectedAgentId}
          >
            <SelectTrigger className="w-64 bg-card" data-testid="select-agent-filter">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {agentsLoading ? (
                <div className="p-2">Loading agents...</div>
              ) : agents?.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="min-w-0 flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card"
                data-testid="input-search-documents"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      {showUpload && selectedAgentId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload Knowledge Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload
              agentId={selectedAgentId}
              onUploadComplete={() => setShowUpload(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      {!selectedAgentId ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Select an agent to view its knowledge documents
            </p>
          </CardContent>
        </Card>
      ) : documentsLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            {searchQuery ? (
              <div>
                <p className="text-muted-foreground mb-4">
                  No documents found matching "{searchQuery}"
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setSearchQuery("")}
                  data-testid="button-clear-search"
                >
                  Clear search
                </Button>
              </div>
            ) : (
              <div>
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No knowledge documents yet
                </p>
                <Button
                  onClick={() => setShowUpload(true)}
                  data-testid="button-upload-first-document"
                >
                  <Upload className="mr-2 w-4 h-4" />
                  Upload your first document
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredDocuments.map((document) => (
            <Card key={document.id} className="hover:bg-muted/50 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium truncate" data-testid={`text-document-name-${document.id}`}>
                        {document.filename}
                      </h4>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                        <span>{formatFileSize(document.fileSize)}</span>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {formatDistanceToNow(new Date(document.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={document.processed ? "default" : "secondary"}
                      data-testid={`badge-document-status-${document.id}`}
                    >
                      {document.processed ? "Processed" : "Processing"}
                    </Badge>
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
