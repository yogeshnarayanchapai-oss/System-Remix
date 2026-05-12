import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  useListAutomationRules, useCreateAutomationRule, useDeleteAutomationRule, useToggleAutomationRule,
  useListReplyTemplates, useCreateReplyTemplate, useDeleteReplyTemplate, useToggleReplyTemplate,
  getListAutomationRulesQueryKey, getListReplyTemplatesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TRIGGER_TYPES = ["new_message", "keyword_match", "followup_due", "lead_created", "no_reply_24h"];

export default function AutomationPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [newRule, setNewRule] = useState({ name: "", description: "", triggerType: "new_message", autoSend: false });
  const [newTemplate, setNewTemplate] = useState({ name: "", category: "general", content: "" });

  const { data: rules, isLoading: rulesLoading } = useListAutomationRules({ query: { queryKey: getListAutomationRulesQueryKey() } });
  const { data: templates, isLoading: templatesLoading } = useListReplyTemplates({ query: { queryKey: getListReplyTemplatesQueryKey() } });
  const createRule = useCreateAutomationRule();
  const deleteRule = useDeleteAutomationRule();
  const toggleRule = useToggleAutomationRule();
  const createTemplate = useCreateReplyTemplate();
  const deleteTemplate = useDeleteReplyTemplate();
  const toggleTemplate = useToggleReplyTemplate();

  const invalidateRules = () => qc.invalidateQueries({ queryKey: getListAutomationRulesQueryKey() });
  const invalidateTemplates = () => qc.invalidateQueries({ queryKey: getListReplyTemplatesQueryKey() });

  const handleCreateRule = async () => {
    try {
      await createRule.mutateAsync({ data: newRule });
      setShowAddRule(false);
      setNewRule({ name: "", description: "", triggerType: "new_message", autoSend: false });
      invalidateRules();
      toast({ title: "Rule created" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const handleCreateTemplate = async () => {
    try {
      await createTemplate.mutateAsync({ data: newTemplate });
      setShowAddTemplate(false);
      setNewTemplate({ name: "", category: "general", content: "" });
      invalidateTemplates();
      toast({ title: "Template created" });
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="p-7 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Automation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage rules and reply templates</p>
        </div>

        <Tabs defaultValue="rules">
          <TabsList>
            <TabsTrigger value="rules">Rules {rules && <Badge variant="secondary" className="ml-1.5 text-xs">{rules.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="templates">Templates {templates && <Badge variant="secondary" className="ml-1.5 text-xs">{templates.length}</Badge>}</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-5 space-y-4">
            <div className="flex justify-end">
              <Button data-testid="button-add-rule" size="sm" onClick={() => setShowAddRule(true)}>
                <Plus size={14} className="mr-1" /> New Rule
              </Button>
            </div>
            {rulesLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            ) : rules?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Zap size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No automation rules yet</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                {rules?.map((rule: any) => (
                  <div key={rule.id} data-testid={`row-rule-${rule.id}`} className="flex items-center gap-4 px-5 py-4">
                    <Switch
                      data-testid={`switch-rule-${rule.id}`}
                      checked={rule.isActive}
                      onCheckedChange={async () => { await toggleRule.mutateAsync({ id: rule.id }); invalidateRules(); }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{rule.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">{rule.triggerType.replace(/_/g, " ")}</Badge>
                        {rule.autoSend && <Badge variant="secondary" className="text-xs">Auto-send</Badge>}
                        {!rule.isActive && <span className="text-xs text-muted-foreground">Inactive</span>}
                      </div>
                    </div>
                    <button
                      data-testid={`button-delete-rule-${rule.id}`}
                      onClick={async () => { await deleteRule.mutateAsync({ id: rule.id }); invalidateRules(); toast({ title: "Rule deleted" }); }}
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-5 space-y-4">
            <div className="flex justify-end">
              <Button data-testid="button-add-template" size="sm" onClick={() => setShowAddTemplate(true)}>
                <Plus size={14} className="mr-1" /> New Template
              </Button>
            </div>
            {templatesLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
            ) : templates?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p className="text-sm">No templates yet</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
                {templates?.map((tpl: any) => (
                  <div key={tpl.id} data-testid={`row-template-${tpl.id}`} className="flex items-start gap-4 px-5 py-4">
                    <Switch
                      data-testid={`switch-template-${tpl.id}`}
                      checked={tpl.isActive}
                      onCheckedChange={async () => { await toggleTemplate.mutateAsync({ id: tpl.id }); invalidateTemplates(); }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                        <Badge variant="outline" className="text-xs">{tpl.category}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tpl.content}</p>
                    </div>
                    <button
                      data-testid={`button-delete-template-${tpl.id}`}
                      onClick={async () => { await deleteTemplate.mutateAsync({ id: tpl.id }); invalidateTemplates(); toast({ title: "Template deleted" }); }}
                      className="p-1.5 text-muted-foreground hover:text-destructive mt-0.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Automation Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input data-testid="input-rule-name" value={newRule.name} onChange={(e) => setNewRule(p => ({ ...p, name: e.target.value }))} placeholder="Rule name" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input data-testid="input-rule-desc" value={newRule.description} onChange={(e) => setNewRule(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
            </div>
            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <select
                data-testid="select-trigger"
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={newRule.triggerType}
                onChange={(e) => setNewRule(p => ({ ...p, triggerType: e.target.value }))}
              >
                {TRIGGER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Switch data-testid="switch-auto-send" checked={newRule.autoSend} onCheckedChange={(v) => setNewRule(p => ({ ...p, autoSend: v }))} />
              <Label>Auto-send</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRule(false)}>Cancel</Button>
            <Button data-testid="button-confirm-rule" onClick={handleCreateRule} disabled={createRule.isPending}>
              {createRule.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddTemplate} onOpenChange={setShowAddTemplate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Reply Template</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input data-testid="input-template-name" value={newTemplate.name} onChange={(e) => setNewTemplate(p => ({ ...p, name: e.target.value }))} placeholder="Template name" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input data-testid="input-template-category" value={newTemplate.category} onChange={(e) => setNewTemplate(p => ({ ...p, category: e.target.value }))} placeholder="e.g. greeting, pricing, support" />
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <textarea
                data-testid="input-template-content"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-none"
                value={newTemplate.content}
                onChange={(e) => setNewTemplate(p => ({ ...p, content: e.target.value }))}
                placeholder="Template message content..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTemplate(false)}>Cancel</Button>
            <Button data-testid="button-confirm-template" onClick={handleCreateTemplate} disabled={createTemplate.isPending}>
              {createTemplate.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
