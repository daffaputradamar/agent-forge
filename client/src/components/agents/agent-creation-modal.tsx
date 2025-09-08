import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateAgent } from "@/hooks/use-agents";
import FileUpload from "@/components/knowledge/file-upload";
import type { CreateAgentData } from "@/types";

const agentSchema = z.object({
  name: z.string().min(1, "Agent name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  category: z.string().min(1, "Category is required"),
  tone: z.string().min(1, "Tone is required"),
  responseStyle: z.string().min(1, "Response style is required"),
  systemInstructions: z.string().min(1, "System instructions are required").max(2000, "Instructions too long"),
});

interface AgentCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AgentCreationModal({ open, onOpenChange }: AgentCreationModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const createAgent = useCreateAgent();

  const form = useForm<CreateAgentData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      tone: "professional",
      responseStyle: "detailed",
      systemInstructions: "",
    },
  });

  const onSubmit = async (data: CreateAgentData) => {
    try {
      const agent = await createAgent.mutateAsync(data);
      setCreatedAgentId(agent.id);
      setCurrentStep(2);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setCurrentStep(1);
    setCreatedAgentId(null);
    form.reset();
  };

  const categories = [
    "Customer Support",
    "Sales",
    "HR",
    "Marketing",
    "Technical Support",
    "General",
  ];

  const tones = [
    "Professional",
    "Friendly",
    "Casual",
    "Formal",
    "Empathetic",
  ];

  const responseStyles = [
    "Detailed",
    "Concise",
    "Step-by-step",
    "Conversational",
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 1 ? "Create New Agent" : "Upload Knowledge (Optional)"}
          </DialogTitle>
        </DialogHeader>

        {currentStep === 1 ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-lg font-medium mb-4">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agent Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Customer Support Bot" 
                            {...field}
                            data-testid="input-agent-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-agent-category">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category} value={category.toLowerCase()}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe what this agent does..." 
                          rows={3} 
                          {...field}
                          data-testid="textarea-agent-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Personality Settings */}
              <div>
                <h4 className="text-lg font-medium mb-4">Personality & Behavior</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-agent-tone">
                              <SelectValue placeholder="Select tone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {tones.map((tone) => (
                              <SelectItem key={tone} value={tone.toLowerCase()}>
                                {tone}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="responseStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Response Style</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-agent-response-style">
                              <SelectValue placeholder="Select style" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {responseStyles.map((style) => (
                              <SelectItem key={style} value={style.toLowerCase()}>
                                {style}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="systemInstructions"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>System Instructions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="You are a helpful customer support agent. Always be polite and provide clear, actionable solutions..." 
                          rows={4} 
                          {...field}
                          data-testid="textarea-agent-instructions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose}
                  data-testid="button-cancel-agent-creation"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAgent.isPending}
                  data-testid="button-create-agent"
                >
                  {createAgent.isPending ? "Creating..." : "Create Agent"}
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium mb-4">Initial Knowledge (Optional)</h4>
              <p className="text-muted-foreground text-sm mb-4">
                Upload documents to give your agent domain-specific knowledge.
              </p>
              
              {createdAgentId && (
                <FileUpload 
                  agentId={createdAgentId}
                  onUploadComplete={() => {}}
                />
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <Button 
                variant="outline" 
                onClick={handleClose}
                data-testid="button-skip-knowledge-upload"
              >
                Skip
              </Button>
              <Button 
                onClick={handleClose}
                data-testid="button-finish-agent-creation"
              >
                Finish
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
