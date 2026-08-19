'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Search, RotateCcw, FileText } from 'lucide-react'
import { listDeletedObjects, restoreDeletedObject, type DeletedObjectRow } from '@/actions/backup'

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function RestorePanel() {
  const [orgSlug, setOrgSlug] = useState('')
  const [objects, setObjects] = useState<DeletedObjectRow[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [pending, startTransition] = useTransition()
  const [restoringId, setRestoringId] = useState<string | null>(null)

  async function handleSearch() {
    const slug = orgSlug.trim()
    if (!slug) return
    setSearching(true)
    try {
      const rows = await listDeletedObjects(slug)
      setObjects(rows)
    } finally {
      setSearching(false)
    }
  }

  function handleRestore(row: DeletedObjectRow, overwrite = false) {
    const confirmMsg = overwrite
      ? `Isso vai SOBRESCREVER a versão ativa atual de "${row.filename || row.storage_key}" com a cópia do backup. Confirma?`
      : `Restaurar "${row.filename || row.storage_key}" a partir do backup? A ação fica registrada no audit log.`
    if (!window.confirm(confirmMsg)) return

    setRestoringId(row.id)
    startTransition(async () => {
      const res = await restoreDeletedObject(orgSlug.trim(), row.id, overwrite)
      setRestoringId(null)
      if (res.ok) {
        toast.success('Objeto restaurado.')
        setObjects(prev => prev?.filter(o => o.id !== row.id) ?? null)
      } else if (res.needsOverwriteConfirmation) {
        handleRestore(row, true)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-sm font-semibold text-white mb-1">Restaurar arquivo</h2>
      <p className="text-xs text-slate-500 mb-4">
        Só restaura objetos que ainda têm registro em <code className="text-slate-400">storage_objects</code> (deletados,
        não hard-delete de metadado). Restore de tenant/banco completo não existe ainda — ver docs/backup-disaster-recovery.md.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          value={orgSlug}
          onChange={e => setOrgSlug(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="slug da organização"
          className="flex-1 rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-white placeholder:text-slate-600"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || !orgSlug.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-50"
        >
          <Search className="w-3.5 h-3.5" /> Buscar
        </button>
      </div>

      {objects === null ? (
        <p className="text-sm text-slate-500">Busca os arquivos deletados de uma organização pelo slug.</p>
      ) : objects.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum arquivo deletado encontrado pra essa organização.</p>
      ) : (
        <ul className="space-y-1.5">
          {objects.map(o => (
            <li key={o.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
              <FileText className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200 truncate">{o.filename || o.storage_key}</div>
                <div className="text-[11px] text-slate-500">
                  {formatBytes(o.size_bytes)} · deletado em {new Date(o.updated_at).toLocaleString('pt-BR')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(o)}
                disabled={pending && restoringId === o.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 shrink-0"
              >
                <RotateCcw className="w-3 h-3" /> {pending && restoringId === o.id ? 'Restaurando…' : 'Restaurar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
