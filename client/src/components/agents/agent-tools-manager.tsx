import { useEffect, useState } from 'react';
import { useTools, useCreateTool, useUpdateTool, useDeleteTool, useExecuteTool } from '@/hooks/use-tools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tool } from '@/types';
import { Plus, Trash2, Play, Loader2, Edit3, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useForm, useFieldArray } from 'react-hook-form';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface Props { agentId: string; filter?: string }

// Zod schemas (client side) mirroring backend expectations with extra UX constraints
const paramSchema = z.object({
    name: z.string().min(1, 'Name required').regex(/^[a-zA-Z_][a-zA-Z0-9_-]*$/, 'Invalid name'),
    type: z.enum(['string', 'number', 'boolean']),
    required: z.boolean().optional(),
    description: z.string().max(200, 'Max 200 chars').optional().or(z.literal('')),
});

const headerEntrySchema = z.object({
    key: z.string().min(1, 'Header key required'),
    value: z.string().max(500, 'Too long').optional().or(z.literal('')),
});

const toolFormSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Max 100 chars'),
    description: z.string().max(500, 'Max 500 chars').optional().or(z.literal('')),
    method: z.enum(['GET', 'POST']),
    endpoint: z.string().min(1, 'Endpoint required').refine(v => /^https?:\/\//i.test(v), 'Must start with http:// or https://'),
    parameters: z.array(paramSchema).max(25, 'Too many parameters').optional().default([]).superRefine((arr: any[], ctx) => {
        const seen = new Set<string>();
        arr.forEach((p: any, idx: number) => {
            const key = (p.name || '').trim().toLowerCase();
            if (seen.has(key)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate parameter name', path: [idx, 'name'] });
            }
            seen.add(key);
        });
    }),
    headers: z.array(headerEntrySchema).max(25, 'Too many headers').optional().default([]).superRefine((arr: any[], ctx) => {
        const seen = new Set<string>();
        arr.forEach((h: any, idx: number) => {
            const key = (h.key || '').trim().toLowerCase();
            if (seen.has(key)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate header key', path: [idx, 'key'] });
            }
            seen.add(key);
        });
    }),
});

type ToolFormValues = z.infer<typeof toolFormSchema>;

const emptyValues: ToolFormValues = { name: '', description: '', method: 'GET', endpoint: '', parameters: [], headers: [] };

export default function AgentToolsManager({ agentId, filter }: Props) {
    const { data: tools, isLoading } = useTools(agentId);
    const createTool = useCreateTool(agentId);
    const updateTool = useUpdateTool(agentId);
    const deleteTool = useDeleteTool(agentId);
    const executeTool = useExecuteTool();

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Tool | null>(null);
    const [showParams, setShowParams] = useState(true);
    const [showHeaders, setShowHeaders] = useState(false);

    const form = useForm<ToolFormValues>({
        defaultValues: emptyValues,
        mode: 'onBlur',
        resolver: zodResolver(toolFormSchema)
    });
    const { control, handleSubmit, reset, setValue, watch } = form;
    const { fields: paramFields, append: appendParam, remove: removeParamField, replace: replaceParam } = useFieldArray({ control, name: 'parameters' });
    const { fields: headerFields, append: appendHeader, remove: removeHeaderField } = useFieldArray({ control, name: 'headers' });

    const resetForm = () => { reset(emptyValues); setEditing(null); setShowForm(false); };

    const startEdit = (tool: Tool) => {
        setEditing(tool);
        reset({
            name: tool.name,
            description: tool.description || '',
            method: tool.method as 'GET' | 'POST',
            endpoint: tool.endpoint,
            parameters: tool.parameters || [],
            headers: tool.headers ? Object.entries(tool.headers).map(([key, value]) => ({ key, value })) : []
        });
        setShowForm(true);
    };

    const addParam = () => { appendParam({ name: '', type: 'string', required: false, description: '' }); };
    const updateParam = (idx: number, patch: Partial<ToolFormValues['parameters'][number]>) => {
        const current = (form.getValues('parameters') as ToolFormValues['parameters']) || [];
        const next = current.map((p, i) => i === idx ? { ...p, ...patch } : p) as ToolFormValues['parameters'];
        replaceParam(next);
    };
    const removeParam = (idx: number) => { removeParamField(idx); };
    const addHeader = () => { appendHeader({ key: '', value: '' }); };
    const removeHeader = (idx: number) => { removeHeaderField(idx); };

    const onSubmit = (values: ToolFormValues) => {
        const cleanParams = ((values.parameters as ToolFormValues['parameters']) || []).filter(p => p.name.trim());
        const headerRecord = ((values.headers as { key: string; value?: string }[]) || []).reduce<Record<string, string>>((acc, h) => {
            if (h.key.trim()) acc[h.key.trim()] = h.value || '';
            return acc;
        }, {} as Record<string, string>);
        const payload: any = { ...values, parameters: cleanParams };
        payload.headers = Object.keys(headerRecord).length ? headerRecord : undefined;
        if (editing) {
            updateTool.mutate({ id: editing.id, data: payload }, { onSuccess: () => { toast.success('Tool updated'); resetForm(); } });
        } else {
            createTool.mutate(payload, { onSuccess: () => { toast.success('Tool created'); resetForm(); } });
        }
    };

    const runTool = (tool: Tool) => {
        // Build param inputs quickly via prompt; future: nicer UI
        const params: Record<string, any> = {};
        (tool.parameters || []).forEach(p => {
            const val = window.prompt(`Value for ${p.name}${p.required ? ' (required)' : ''}:`, '');
            if (val !== null && val !== '') params[p.name] = val;
        });
        executeTool.mutate({ id: tool.id, params }, {
            onSuccess: (res) => {
                toast.success('Executed tool');
                console.log('Tool result', res);
                alert(`Status: ${res.status}\nTime: ${res.elapsedMs}ms\nData: ${typeof res.data === 'string' ? res.data.slice(0, 500) : JSON.stringify(res.data).slice(0, 500)}`);
            },
            onError: (err: any) => {
                toast.error('Execution failed');
            }
        });
    };

    // Filter tools before render
    const visibleTools = tools?.filter(t => {
        if (!filter) return true;
        const q = filter.toLowerCase();
        return (
            t.name.toLowerCase().includes(q) ||
            (t.description || '').toLowerCase().includes(q) ||
            t.endpoint.toLowerCase().includes(q)
        );
    });

    // Allow external trigger to open create form
    if (typeof window !== 'undefined') {
        // lightweight guard to avoid multiple listeners - rely on showForm state toggle
        (window as any)._agentToolsCreateHandler ||= () => setShowForm(true);
        window.removeEventListener('agent-tools:new', (window as any)._agentToolsCreateHandler);
        window.addEventListener('agent-tools:new', (window as any)._agentToolsCreateHandler);
    }

    // Reset form values when switching to create after editing cleared
    useEffect(() => {
        if (!showForm && !editing) {
            reset(emptyValues);
        }
    }, [showForm, editing, reset]);

    return (
        <div className="space-y-4">
            {showForm && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{editing ? 'Edit Tool' : 'Add New Tool'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 border rounded-md p-3 bg-muted/30">
                                <div className="grid md:grid-cols-2 gap-3">
                                    <FormField name="name" control={control} rules={{ required: 'Name is required' }} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Tool name" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField name="method" control={control} rules={{ required: true }} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Method</FormLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue placeholder="Select method" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="GET">GET</SelectItem>
                                                    <SelectItem value="POST">POST</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField name="endpoint" control={control} rules={{ required: 'Endpoint required' }} render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Endpoint URL</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="https://api.example.com/path" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormField name="description" control={control} render={({ field }) => (
                                        <FormItem className="md:col-span-2">
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <Textarea {...field} rows={2} />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                    <span className="text-xs font-medium">Parameters ({paramFields.length})</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Show</span>
                                        <Switch checked={showParams} onCheckedChange={v => setShowParams(v)} />
                                        <Button type="button" variant="outline" size="sm" onClick={addParam}><Plus className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                                {form.formState.errors.parameters && (
                                    <p className="text-xs text-red-500">{(form.formState.errors.parameters as any).message || 'Check parameters'}</p>
                                )}
                                {showParams && (
                                    <div className="space-y-2">
                                        {paramFields.length === 0 && (
                                            <p className="text-xs text-muted-foreground">No parameters added.</p>
                                        )}
                                        {paramFields.map((p, i) => {
                                            const params = watch('parameters');
                                            return (
                                                <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
                                                    <Input className="col-span-3" placeholder="name" {...form.register(`parameters.${i}.name` as const)} />
                                                    <div className="col-span-2">
                                                        <Select value={params?.[i]?.type} onValueChange={(val) => setValue(`parameters.${i}.type`, val as any, { shouldDirty: true })}>
                                                            <SelectTrigger className="h-9">
                                                                <SelectValue placeholder="type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="string">string</SelectItem>
                                                                <SelectItem value="number">number</SelectItem>
                                                                <SelectItem value="boolean">boolean</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="col-span-2 flex items-center gap-2 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <Checkbox checked={!!params?.[i]?.required} onCheckedChange={(val) => setValue(`parameters.${i}.required`, !!val, { shouldDirty: true })} id={`param-${i}-required`} />
                                                            <label htmlFor={`param-${i}-required`} className="cursor-pointer select-none">Required</label>
                                                        </div>
                                                    </div>
                                                    <Input className="col-span-4" placeholder="description" {...form.register(`parameters.${i}.description` as const)} />
                                                    <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => removeParam(i)}><Trash2 className="w-4 h-4" /></Button>
                                                    {form.formState.errors.parameters && (form.formState.errors.parameters as any)[i]?.name && (
                                                        <p className="col-span-12 text-[10px] text-red-500 -mt-1">{(form.formState.errors.parameters as any)[i].name.message}</p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Headers Section */}
                                <div className="flex items-center justify-between mt-4">
                                    <span className="text-xs font-medium">HTTP Headers ({headerFields.length})</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Show</span>
                                        <Switch checked={showHeaders} onCheckedChange={v => setShowHeaders(v)} />
                                        <Button type="button" variant="outline" size="sm" onClick={addHeader}><Plus className="w-4 h-4" /></Button>
                                    </div>
                                </div>
                                {form.formState.errors.headers && (
                                    <p className="text-xs text-red-500">{(form.formState.errors.headers as any).message || 'Check headers'}</p>
                                )}
                                {showHeaders && (
                                    <div className="space-y-2">
                                        {headerFields.length === 0 && (
                                            <p className="text-xs text-muted-foreground">No headers added.</p>
                                        )}
                                        {headerFields.map((h, i) => (
                                            <div key={h.id} className="grid grid-cols-12 gap-2 items-center">
                                                <Input className="col-span-4" placeholder="Header name" {...form.register(`headers.${i}.key` as const)} />
                                                <Input className="col-span-7" placeholder="value" {...form.register(`headers.${i}.value` as const)} />
                                                <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => removeHeader(i)}><Trash2 className="w-4 h-4" /></Button>
                                                {form.formState.errors.headers && (form.formState.errors.headers as any)[i]?.key && (
                                                    <p className="col-span-12 text-[10px] text-red-500 -mt-1">{(form.formState.errors.headers as any)[i].key.message}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                                    <Button type="submit" disabled={createTool.isPending || updateTool.isPending}>
                                        {(createTool.isPending || updateTool.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                        {editing ? (<span className="flex items-center gap-1"><Save className="w-4 h-4" /> Save</span>) : 'Create Tool'}
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

            )}
            <div className="space-y-2">
                {isLoading && <p className="text-sm text-muted-foreground">Loading tools...</p>}
                {!isLoading && (!visibleTools || visibleTools.length === 0) && <p className="text-sm text-muted-foreground">No tools{filter ? ' matching search' : ''}.</p>}

                {visibleTools && visibleTools.map(t => (
                    <Card key={t.id}>
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className='flex flex-col gap-4'>
                                    <CardTitle>{t.name}</CardTitle>
                                    <p className="text-xs text-muted-foreground"><span className='font-semibold'>{t.method}</span> {t.endpoint}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="icon" variant="outline" onClick={() => startEdit(t)} title="Edit"><Edit3 className="w-4 h-4" /></Button>
                                    <Button size="icon" variant="outline" onClick={() => runTool(t)} disabled={executeTool.isPending && executeTool.variables?.id === t.id} title="Execute">
                                        {executeTool.isPending && executeTool.variables?.id === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                    </Button>
                                    <Button size="icon" variant="destructive" onClick={() => { if (confirm('Delete tool?')) deleteTool.mutate(t.id, { onSuccess: () => toast.success('Tool deleted') }); }} title="Delete"><Trash2 className="w-4 h-4" /></Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2">
                                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                                {t.parameters && t.parameters.length > 0 && (
                                    <div className="bg-muted/40 rounded p-2">
                                        <p className="text-[10px] uppercase tracking-wide font-semibold mb-1">Parameters</p>
                                        <ul className="space-y-1">
                                            {t.parameters.map(p => (
                                                <li key={p.name} className="text-xs flex items-center justify-between">
                                                    <span>{p.name}{p.required && <span className="text-red-500 ml-1">*</span>}<span className="text-muted-foreground ml-1">({p.type})</span></span>
                                                    {p.description && <span className="text-muted-foreground truncate ml-2">{p.description}</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
