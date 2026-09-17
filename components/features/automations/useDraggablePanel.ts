import { useEffect, useRef, useState } from 'react'

/**
 * Torna um painel flutuante (node/edge edit panel do canvas de Automações)
 * arrastável pelo cabeçalho — pedido explícito depois que os painéis
 * passaram a abrir ancorados no clique (campos largos às vezes ficam perto
 * da borda). Puramente client-side, não persiste posição entre aberturas:
 * cada vez que `initial` muda (painel reaberto em outro node/edge), a
 * posição arrastada é descartada e volta a seguir a âncora nova.
 */
export function useDraggablePosition(initial: { top: number; left: number } | undefined) {
  const [dragged, setDragged] = useState<{ top: number; left: number } | null>(null)
  const dragState = useRef<{ startX: number; startY: number; origTop: number; origLeft: number } | null>(null)

  useEffect(() => { setDragged(null) }, [initial?.top, initial?.left])

  const current = dragged ?? initial

  function onHeaderMouseDown(e: React.MouseEvent) {
    if (!current || e.button !== 0) return
    e.preventDefault()
    dragState.current = { startX: e.clientX, startY: e.clientY, origTop: current.top, origLeft: current.left }

    function onMove(ev: MouseEvent) {
      if (!dragState.current) return
      setDragged({
        top: dragState.current.origTop + (ev.clientY - dragState.current.startY),
        left: dragState.current.origLeft + (ev.clientX - dragState.current.startX),
      })
    }
    function onUp() {
      dragState.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return { style: current, onHeaderMouseDown }
}
