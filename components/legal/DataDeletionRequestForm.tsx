'use client'

import { useState } from 'react'
import { submitDataDeletionRequest } from '@/actions/data-deletion'

export default function DataDeletionRequestForm() {
  const [businessUsername, setBusinessUsername] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [protocol, setProtocol] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessUsername.trim()) {
      setError('Informe o @ do Instagram da empresa que você contatou.')
      return
    }
    setSending(true)
    setError(null)
    const res = await submitDataDeletionRequest({
      business_username: businessUsername,
      requester_name: name || undefined,
      requester_contact: contact || undefined,
      message: message || undefined,
    })
    setSending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setProtocol(res.protocol)
  }

  if (protocol) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <p className="font-semibold">Pedido registrado com sucesso.</p>
        <p className="mt-1">
          Protocolo: <code className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs">{protocol}</code>
        </p>
        <p className="mt-2 text-emerald-700">
          A empresa que você contatou foi notificada e vai excluir seus dados. Guarde o protocolo caso precise
          entrar em contato novamente.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          @ do Instagram da empresa que você contatou <span className="text-red-500">*</span>
        </label>
        <input
          value={businessUsername}
          onChange={e => setBusinessUsername(e.target.value)}
          placeholder="@nomedaempresa"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Seu nome</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Como você quer ser chamado(a)"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Seu @ do Instagram, e-mail ou telefone</label>
        <input
          value={contact}
          onChange={e => setContact(e.target.value)}
          placeholder="Para identificarmos sua conversa"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Detalhes (opcional)</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          placeholder="Alguma informação adicional que ajude a localizar seus dados"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={sending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500 transition-colors disabled:opacity-60"
      >
        {sending ? 'Enviando...' : 'Solicitar exclusão dos meus dados'}
      </button>
    </form>
  )
}
