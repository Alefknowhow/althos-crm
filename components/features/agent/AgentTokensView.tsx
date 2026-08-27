'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { KeyRound, Loader2, Copy, Trash2, Plus } from 'lucide-react'
import { createAgentToken, revokeAgentToken, type AgentToken } from '@/actions/agent-tokens'

const AGENT_LABELS: Record<string, string> = {
  claude_code: 'Claude Code',
  codex: 'Codex',
  outro: 'Outro',
}

export default function AgentTokensView({ orgSlug, tokens }: { orgSlug: string; tokens: AgentToken[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [agentLabel, setAgentLabel] = useState<'claude_code' | 'codex' | 'outro'>('claude_code')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) { toast.error('Informe um nome pro token'); return }
    setCreating(true)
    const res = await createAgentToken(orgSlug, { name, agentLabel })
    setCreating(false)
    if (!res.ok) { toast.error(res.error); return }
    setNewToken(res.token)
    router.refresh()
  }

  function closeDialog() {
    setOpen(false)
    setNewToken(null)
    setName('')
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revogar este token? Agentes conectados com ele perderão acesso imediatamente.')) return
    const res = await revokeAgentToken(orgSlug, id)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Token revogado')
    router.refresh()
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5" /> Conector MCP</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tokens usados por Claude Code, Codex e outros agentes MCP pra acessar o Althos em seu nome.
          </p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) closeDialog() }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1.5" /> Criar token</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo token de agente</DialogTitle>
            </DialogHeader>
            {newToken ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Copie o token agora — ele não será mostrado novamente.
                </p>
                <div className="flex items-center gap-2">
                  <Input readOnly value={newToken} className="font-mono text-xs" />
                  <Button
                    size="icon" variant="outline"
                    onClick={() => { navigator.clipboard.writeText(newToken); toast.success('Copiado') }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button size="sm" onClick={closeDialog}>Concluído</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nome</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Meu Claude Code" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Agente</label>
                  <Select value={agentLabel} onValueChange={v => setAgentLabel(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude_code">Claude Code</SelectItem>
                      <SelectItem value="codex">Codex</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={handleCreate} disabled={creating}>
                  {creating && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Criar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tokens ativos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum token criado ainda.</p>
          ) : (
            tokens.map(t => (
              <div key={t.id} className="flex items-center justify-between border rounded-md p-2.5 text-sm">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {t.name}
                    <Badge variant="outline">{AGENT_LABELS[t.agent_label]}</Badge>
                    {t.revoked_at && <Badge variant="outline" className="bg-muted text-muted-foreground">Revogado</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.token_prefix}… · criado em {new Date(t.created_at).toLocaleDateString('pt-BR')}
                    {t.last_used_at && ` · último uso ${new Date(t.last_used_at).toLocaleDateString('pt-BR')}`}
                  </div>
                </div>
                {!t.revoked_at && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRevoke(t.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
