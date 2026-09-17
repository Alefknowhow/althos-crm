'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Users, Trash2, Loader2 } from 'lucide-react'
import {
  inviteClientPortalUser, listClientPortalMembers, removeClientPortalMembership,
  type ClientPortalMember, type ClientPortalRole,
} from '@/actions/client-portal'

/** Gestão de acesso ao Portal do Cliente — convite/lista/remoção de
 *  usuários externos vinculados a ESTE cliente (client_portal_memberships).
 *  Nunca dá acesso ao workspace interno — só ao /portal/[contatoId]. */
export default function ClientPortalAccessCard({ orgSlug, contatoId }: { orgSlug: string; contatoId: string }) {
  const [members, setMembers] = useState<ClientPortalMember[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ClientPortalRole>('client_member')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    listClientPortalMembers(orgSlug, contatoId).then(m => { setMembers(m); setLoading(false) })
  }, [orgSlug, contatoId])

  async function handleInvite() {
    if (!email.trim()) return
    setInviting(true)
    const res = await inviteClientPortalUser(orgSlug, contatoId, { email: email.trim(), role })
    setInviting(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Convite enviado — o cliente recebe um e-mail pra definir a senha.')
    setEmail('')
    setMembers(await listClientPortalMembers(orgSlug, contatoId))
  }

  async function handleRemove(id: string) {
    const res = await removeClientPortalMembership(orgSlug, id)
    if (!res.ok) { toast.error(res.error); return }
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" /> Acesso ao Portal do Cliente</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@cliente.com" className="h-8 text-sm max-w-xs" />
          <Select value={role} onValueChange={v => setRole(v as ClientPortalRole)}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="client_member">Membro</SelectItem>
              <SelectItem value="client_admin">Admin do cliente</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleInvite} disabled={inviting || !email.trim()}>
            {inviting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null} Convidar
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário com acesso ao portal ainda.</p>
        ) : (
          <div className="divide-y">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                <span>{m.email || m.user_id}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.role === 'client_admin' ? 'Admin do cliente' : 'Membro'}</Badge>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRemove(m.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
