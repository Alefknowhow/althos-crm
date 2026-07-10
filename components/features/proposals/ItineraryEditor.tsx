'use client'

import { useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontFamily, FontSize } from '@tiptap/extension-text-style'
import { toast } from 'sonner'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Heading1, Heading2, Heading3,
  AlignLeft, AlignCenter, AlignRight,
  Image as ImageIcon, Undo, Redo, Minus,
} from 'lucide-react'
import { uploadFormAsset } from '@/actions/upload'

const FONT_FAMILIES = [
  { label: 'Fonte padrão', value: '' },
  { label: 'Serifada (Georgia)', value: 'Georgia, serif' },
  { label: 'Clássica (Times)', value: '"Times New Roman", Times, serif' },
  { label: 'Moderna (Arial)', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Manuscrita (cursive)', value: '"Segoe Script", "Comic Sans MS", cursive' },
  { label: 'Monoespaçada', value: '"Courier New", monospace' },
]
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']

function TB({
  active, onClick, disabled, title, children,
}: { active?: boolean; onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center justify-center w-8 h-8 rounded text-sm transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
      } disabled:opacity-50 disabled:cursor-not-allowed`}>
      {children}
    </button>
  )
}

/**
 * Editor do Roteiro da proposta: rich text com fontes/tamanhos e imagens.
 * Imagens entram por botão, arrastar-e-soltar ou Ctrl+V e são enviadas ao
 * bucket form-assets (URL pública permanente) antes de inserir no documento.
 */
export default function ItineraryEditor({
  orgSlug, value, onChange,
}: { orgSlug: string; value: string; onChange: (html: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadAndInsert = useCallback(async (file: File, editor: any) => {
    if (!file.type.startsWith('image/')) return false
    const fd = new FormData()
    fd.append('file', file)
    const res = await uploadFormAsset(orgSlug, fd)
    if (res.ok) {
      editor.chain().focus().setImage({ src: res.url, alt: file.name }).run()
      toast.success('Imagem adicionada ao roteiro')
    } else {
      toast.error(res.error)
    }
    return true
  }, [orgSlug])

  const editor = useEditor({
    immediatelyRender: false, // SSR-safe — must be false in Next App Router
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      Image.configure({ HTMLAttributes: { style: 'max-width: 100%; height: auto;' } }),
      Placeholder.configure({ placeholder: 'Escreva o roteiro dia a dia… Cole ou arraste imagens direto aqui.' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle, FontFamily, FontSize,
    ],
    content: value || '',
    onUpdate({ editor }) { onChange(editor.getHTML()) },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[260px] px-4 py-3',
      },
      // Ctrl+V com imagem no clipboard → upload + insere no lugar do colar padrão
      handlePaste: (_view, event) => {
        const items = Array.from(event.clipboardData?.items || [])
        const img = items.find(i => i.type.startsWith('image/'))
        if (img) {
          const file = img.getAsFile()
          if (file && editor) { void uploadAndInsert(file, editor); return true }
        }
        return false
      },
      // Arrastar imagem para o editor → upload + insere
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files || [])
        const img = files.find(f => f.type.startsWith('image/'))
        if (img && editor) { event.preventDefault(); void uploadAndInsert(img, editor); return true }
        return false
      },
    },
  })

  if (!editor) {
    return <div className="border rounded-md p-3 text-sm text-muted-foreground">Carregando editor…</div>
  }

  const currentFont = editor.getAttributes('textStyle').fontFamily || ''
  const currentSize = editor.getAttributes('textStyle').fontSize || ''

  return (
    <div className="border rounded-md bg-background">
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden"
        onChange={async e => {
          const f = e.target.files?.[0]
          if (f) await uploadAndInsert(f, editor)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }} />

      <div className="border-b px-2 py-1.5 flex flex-wrap gap-1 items-center">
        {/* Tipo e tamanho de fonte */}
        <select
          value={currentFont}
          onChange={e => {
            const v = e.target.value
            if (v) editor.chain().focus().setFontFamily(v).run()
            else editor.chain().focus().unsetFontFamily().run()
          }}
          className="h-8 rounded border bg-background px-1.5 text-xs text-muted-foreground max-w-[150px]"
          title="Tipo de fonte">
          {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select
          value={currentSize}
          onChange={e => {
            const v = e.target.value
            if (v) editor.chain().focus().setFontSize(v).run()
            else editor.chain().focus().unsetFontSize().run()
          }}
          className="h-8 rounded border bg-background px-1.5 text-xs text-muted-foreground"
          title="Tamanho da fonte">
          <option value="">Tam.</option>
          {FONT_SIZES.map(s => <option key={s} value={s}>{s.replace('px', '')}</option>)}
        </select>

        <div className="w-px h-5 bg-border mx-1" />

        <TB title="Negrito (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-4 h-4" /></TB>
        <TB title="Itálico (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-4 h-4" /></TB>
        <TB title="Sublinhado (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-4 h-4" /></TB>
        <TB title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></TB>

        <div className="w-px h-5 bg-border mx-1" />

        <TB title="Título" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></TB>
        <TB title="Título médio" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></TB>
        <TB title="Subtítulo" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></TB>

        <div className="w-px h-5 bg-border mx-1" />

        <TB title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-4 h-4" /></TB>
        <TB title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></TB>
        <TB title="Linha divisória" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="w-4 h-4" /></TB>

        <div className="w-px h-5 bg-border mx-1" />

        <TB title="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="w-4 h-4" /></TB>
        <TB title="Centralizar" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="w-4 h-4" /></TB>
        <TB title="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="w-4 h-4" /></TB>

        <div className="w-px h-5 bg-border mx-1" />

        <TB title="Inserir imagem (ou cole/arraste no texto)" onClick={() => fileInputRef.current?.click()}><ImageIcon className="w-4 h-4" /></TB>

        <div className="w-px h-5 bg-border mx-1" />

        <TB title="Desfazer" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo className="w-4 h-4" /></TB>
        <TB title="Refazer" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo className="w-4 h-4" /></TB>
      </div>

      <EditorContent editor={editor} />
    </div>
  )
}
