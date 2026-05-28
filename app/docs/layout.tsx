import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 border-r p-6 hidden md:block">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <h2 className="font-bold mb-4">Documentação</h2>
        <nav className="space-y-2 text-sm">
          <Link href="/docs/primeiro-form" className="block hover:text-primary transition-colors">Criar primeiro formulário</Link>
          <Link href="/docs/whatsapp" className="block hover:text-primary transition-colors">Configurar WhatsApp</Link>
          <Link href="/docs/automacao" className="block hover:text-primary transition-colors">Criar automações</Link>
          <Link href="/docs/faq" className="block hover:text-primary transition-colors">Perguntas Frequentes</Link>
        </nav>
      </aside>
      <main className="flex-1 p-8 max-w-4xl">
        <Link
          href="/"
          className="md:hidden inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        {children}
      </main>
    </div>
  )
}
