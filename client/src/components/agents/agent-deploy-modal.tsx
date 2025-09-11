import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { usePublishAgent, useAgent } from '@/hooks/use-agents';
import type { Agent } from '@/types';
import { Copy, RotateCcw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface AgentDeployModalProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AgentDeployModal({ agent, open, onOpenChange }: AgentDeployModalProps) {
  const publish = usePublishAgent();
  const { data: freshAgent } = useAgent(agent?.id || '');

  const current = freshAgent || agent;

  const handleToggle = (value: boolean) => {
    if(!agent) return;
    publish.mutate({ id: agent.id, data: { allowEmbed: value, embedAllowedOrigins: current?.embedAllowedOrigins || '*' } });
  };

  const handleSaveOrigins = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if(!agent) return;
    const form = e.currentTarget;
    const origins = (form.elements.namedItem('origins') as HTMLTextAreaElement).value.trim();
    publish.mutate({ id: agent.id, data: { allowEmbed: true, embedAllowedOrigins: origins || '*' } });
  };

  const handleRotate = () => {
    if(!agent) return;
  publish.mutate({ id: agent.id, data: { allowEmbed: true, embedAllowedOrigins: current?.embedAllowedOrigins || '*', rotate: true } });
  };

  const snippet = current?.publicKey ? `<script src="${window.location.origin}/embed.js" data-agent-key="${current.publicKey}" data-theme="light"></script>` : '';

  const copySnippet = () => {
    if(!snippet) return;
    navigator.clipboard.writeText(snippet);
    toast.success('Embed snippet copied');
  };

  const preview = () => {
    if(!current?.publicKey) return;
    const url = `${window.location.origin}/embed/widget?key=${current.publicKey}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    if(!open) return;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Embed / Deploy Agent</DialogTitle>
        </DialogHeader>
        {!current && <p className="text-sm text-muted-foreground">Loading agent...</p>}
        {current && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <p className="font-medium">Enable Embedding</p>
                <p className="text-xs text-muted-foreground">Allow this agent to be embedded on external websites.</p>
              </div>
              <Switch checked={!!current.allowEmbed} onCheckedChange={handleToggle} />
            </div>

            {current.allowEmbed && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="origins">Allowed Origins</Label>
                  <p className="text-xs text-muted-foreground">Comma separated list of origins (e.g. https://example.com, https://app.example.com). Use * to allow all (not recommended) or prefix with . for any subdomain (.example.com).</p>
                  <form onSubmit={handleSaveOrigins} className="space-y-2">
                    <Textarea name="origins" id="origins" defaultValue={current.embedAllowedOrigins || '*'} className="bg-card min-h-[80px]" />
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" disabled={publish.isPending}>Save Origins</Button>
                    </div>
                  </form>
                </div>

                <div className="space-y-2">
                  <Label>Public Key</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={current.publicKey || ''} className="bg-card" />
                    <Button type="button" variant="secondary" size="icon" onClick={() => { if(current.publicKey){navigator.clipboard.writeText(current.publicKey); toast.success('Public key copied');}}}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="secondary" size="icon" onClick={handleRotate} title="Rotate key (regenerate)">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="secondary" size="icon" onClick={preview} title="Preview widget">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Embed Snippet</Label>
                  <p className="text-xs text-muted-foreground">Paste just before the closing &lt;/body&gt; tag on the site you want to embed.</p>
                  <Textarea readOnly value={snippet} className="font-mono text-xs bg-card" />
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={copySnippet} disabled={!snippet}>Copy Snippet</Button>
                  </div>
                </div>

              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
