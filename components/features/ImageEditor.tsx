'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RotateCw, Pencil, Eraser, Type, Crop, Check, Undo2, X } from 'lucide-react'

const COLORS = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7']

type Tool = 'none' | 'pen' | 'eraser' | 'text' | 'crop'

/**
 * Editor de imagem simples embutido no composer do chat — rotacionar,
 * desenhar (caneta/borracha), adicionar texto e recortar. Trabalha em cima
 * de dois canvases empilhados (base = a foto, overlay = desenho/texto,
 * transparente) pra a borracha poder apagar só o que foi desenhado sem
 * afetar a foto. "Aplicar" achata tudo num Blob final.
 */
export default function ImageEditor({
  file,
  onCancel,
  onApply,
}: {
  file: File
  onCancel: () => void
  onApply: (file: File) => void
}) {
  const baseCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<Tool>('none')
  const [color, setColor] = useState(COLORS[2])
  const [ready, setReady] = useState(false)
  const drawingRef = useRef(false)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const cropStartRef = useRef<{ x: number; y: number } | null>(null)
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null)
  const [history, setHistory] = useState<ImageData[]>([]) // snapshots do overlay pra desfazer

  // Carrega a imagem original nos dois canvases (base = foto, overlay = vazio).
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const base = baseCanvasRef.current
      const overlay = overlayCanvasRef.current
      if (!base || !overlay) return
      base.width = overlay.width = img.naturalWidth
      base.height = overlay.height = img.naturalHeight
      base.getContext('2d')!.drawImage(img, 0, 0)
      setReady(true)
    }
    img.src = URL.createObjectURL(file)
    return () => URL.revokeObjectURL(img.src)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = overlayCanvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  function pushHistory() {
    const overlay = overlayCanvasRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')!
    setHistory(prev => [...prev.slice(-9), ctx.getImageData(0, 0, overlay.width, overlay.height)])
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === 'pen' || tool === 'eraser') {
      pushHistory()
      drawingRef.current = true
      lastPointRef.current = canvasPoint(e)
    } else if (tool === 'crop') {
      const p = canvasPoint(e)
      cropStartRef.current = p
      setCropRect({ x: p.x, y: p.y, w: 0, h: 0 })
    } else if (tool === 'text') {
      const p = canvasPoint(e)
      setTextInput({ x: p.x, y: p.y, value: '' })
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if ((tool === 'pen' || tool === 'eraser') && drawingRef.current) {
      const overlay = overlayCanvasRef.current!
      const ctx = overlay.getContext('2d')!
      const p = canvasPoint(e)
      const last = lastPointRef.current
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = tool === 'eraser' ? 28 : 6
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
      ctx.strokeStyle = color
      ctx.beginPath()
      if (last) ctx.moveTo(last.x, last.y)
      else ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
      lastPointRef.current = p
    } else if (tool === 'crop' && cropStartRef.current) {
      const p = canvasPoint(e)
      const s = cropStartRef.current
      setCropRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
    }
  }

  function handlePointerUp() {
    drawingRef.current = false
    lastPointRef.current = null
    cropStartRef.current = null
  }

  function commitText() {
    if (!textInput || !textInput.value.trim()) { setTextInput(null); return }
    pushHistory()
    const overlay = overlayCanvasRef.current!
    const ctx = overlay.getContext('2d')!
    ctx.globalCompositeOperation = 'source-over'
    const fontSize = Math.round(overlay.width / 18)
    ctx.font = `bold ${fontSize}px sans-serif`
    ctx.fillStyle = color
    ctx.strokeStyle = color === '#ffffff' ? '#000000' : '#ffffff'
    ctx.lineWidth = Math.max(2, fontSize / 12)
    ctx.textBaseline = 'top'
    ctx.strokeText(textInput.value, textInput.x, textInput.y)
    ctx.fillText(textInput.value, textInput.x, textInput.y)
    setTextInput(null)
  }

  function handleUndo() {
    const overlay = overlayCanvasRef.current
    if (!overlay || history.length === 0) return
    const ctx = overlay.getContext('2d')!
    const prev = history[history.length - 1]
    ctx.putImageData(prev, 0, 0)
    setHistory(h => h.slice(0, -1))
  }

  function handleRotate() {
    const base = baseCanvasRef.current
    const overlay = overlayCanvasRef.current
    if (!base || !overlay) return
    for (const canvas of [base, overlay]) {
      const w = canvas.width, h = canvas.height
      const tmp = document.createElement('canvas')
      tmp.width = h
      tmp.height = w
      const tctx = tmp.getContext('2d')!
      tctx.translate(h / 2, w / 2)
      tctx.rotate(Math.PI / 2)
      tctx.drawImage(canvas, -w / 2, -h / 2)
      canvas.width = h
      canvas.height = w
      canvas.getContext('2d')!.drawImage(tmp, 0, 0)
    }
    setHistory([])
  }

  function applyCrop() {
    if (!cropRect || cropRect.w < 5 || cropRect.h < 5) { setCropRect(null); setTool('none'); return }
    const base = baseCanvasRef.current
    const overlay = overlayCanvasRef.current
    if (!base || !overlay) return
    const { x, y, w, h } = cropRect
    for (const canvas of [base, overlay]) {
      const tmp = document.createElement('canvas')
      tmp.width = w
      tmp.height = h
      tmp.getContext('2d')!.drawImage(canvas, x, y, w, h, 0, 0, w, h)
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(tmp, 0, 0)
    }
    setCropRect(null)
    setTool('none')
    setHistory([])
  }

  function handleApply() {
    const base = baseCanvasRef.current
    const overlay = overlayCanvasRef.current
    if (!base || !overlay) return
    const out = document.createElement('canvas')
    out.width = base.width
    out.height = base.height
    const octx = out.getContext('2d')!
    octx.drawImage(base, 0, 0)
    octx.drawImage(overlay, 0, 0)
    out.toBlob(blob => {
      if (!blob) return
      const edited = new File([blob], file.name.replace(/\.\w+$/, '') + '-editado.jpg', { type: 'image/jpeg' })
      onApply(edited)
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 bg-black/80 shrink-0">
        <button type="button" onClick={onCancel} className="text-white/80 hover:text-white p-1" aria-label="Cancelar edição">
          <X className="w-5 h-5" />
        </button>
        <span className="text-sm text-white/70">Editar imagem</span>
        <button type="button" onClick={handleApply} disabled={!ready} className="text-primary font-medium text-sm disabled:opacity-40">
          Concluir
        </button>
      </div>

      <div ref={containerRef} className="flex-1 flex items-center justify-center bg-black/60 overflow-hidden relative p-2">
        <div className="relative max-w-full max-h-full">
          <canvas ref={baseCanvasRef} className="max-w-full max-h-[50vh] object-contain block" />
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full touch-none"
            style={{ cursor: tool === 'none' ? 'default' : 'crosshair' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {tool === 'crop' && cropRect && (
            <div
              className="absolute border-2 border-dashed border-white pointer-events-none"
              style={{
                left: `${(cropRect.x / (overlayCanvasRef.current?.width || 1)) * 100}%`,
                top: `${(cropRect.y / (overlayCanvasRef.current?.height || 1)) * 100}%`,
                width: `${(cropRect.w / (overlayCanvasRef.current?.width || 1)) * 100}%`,
                height: `${(cropRect.h / (overlayCanvasRef.current?.height || 1)) * 100}%`,
              }}
            />
          )}
          {textInput && (
            <input
              autoFocus
              value={textInput.value}
              onChange={e => setTextInput(t => t && { ...t, value: e.target.value })}
              onBlur={commitText}
              onKeyDown={e => e.key === 'Enter' && commitText()}
              className="absolute bg-transparent border border-dashed border-white text-white text-lg font-bold outline-none px-1"
              style={{
                left: `${(textInput.x / (overlayCanvasRef.current?.width || 1)) * 100}%`,
                top: `${(textInput.y / (overlayCanvasRef.current?.height || 1)) * 100}%`,
                color,
              }}
            />
          )}
        </div>
      </div>

      {tool === 'crop' && cropRect && cropRect.w > 5 && (
        <div className="flex justify-center gap-2 py-2 bg-black/80">
          <Button size="sm" variant="secondary" onClick={() => { setCropRect(null); setTool('none') }}>Cancelar recorte</Button>
          <Button size="sm" onClick={applyCrop}><Check className="w-4 h-4 mr-1" /> Aplicar corte</Button>
        </div>
      )}

      {(tool === 'pen' || tool === 'eraser' || tool === 'text') && (
        <div className="flex items-center justify-center gap-2 py-2 bg-black/80">
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-primary' : 'border-white/30'}`}
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-1 px-3 py-2.5 bg-black/80 shrink-0">
        <button type="button" onClick={handleRotate} className={`p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10`} title="Girar">
          <RotateCw className="w-5 h-5" />
        </button>
        <button type="button" onClick={() => setTool(t => t === 'crop' ? 'none' : 'crop')} className={`p-2.5 rounded-full hover:bg-white/10 ${tool === 'crop' ? 'text-primary bg-white/10' : 'text-white/80 hover:text-white'}`} title="Recortar">
          <Crop className="w-5 h-5" />
        </button>
        <button type="button" onClick={() => setTool(t => t === 'pen' ? 'none' : 'pen')} className={`p-2.5 rounded-full hover:bg-white/10 ${tool === 'pen' ? 'text-primary bg-white/10' : 'text-white/80 hover:text-white'}`} title="Caneta">
          <Pencil className="w-5 h-5" />
        </button>
        <button type="button" onClick={() => setTool(t => t === 'eraser' ? 'none' : 'eraser')} className={`p-2.5 rounded-full hover:bg-white/10 ${tool === 'eraser' ? 'text-primary bg-white/10' : 'text-white/80 hover:text-white'}`} title="Borracha">
          <Eraser className="w-5 h-5" />
        </button>
        <button type="button" onClick={() => setTool(t => t === 'text' ? 'none' : 'text')} className={`p-2.5 rounded-full hover:bg-white/10 ${tool === 'text' ? 'text-primary bg-white/10' : 'text-white/80 hover:text-white'}`} title="Adicionar texto">
          <Type className="w-5 h-5" />
        </button>
        <button type="button" onClick={handleUndo} disabled={history.length === 0} className="p-2.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30" title="Desfazer">
          <Undo2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
