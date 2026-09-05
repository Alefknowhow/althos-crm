import { useEffect, useRef } from 'react'

/* ----------------------------- Behaviors (JS portado) ----------------------------- */
export function Behaviors() {
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // `lite`: aparelhos onde os efeitos pesados de GPU/canvas devem ser
    // pulados para não estourar o renderer (crash "Ah, não!" no mobile).
    // Inclui touch, telas pequenas, pouca RAM e reduced-motion. O spotlight
    // e o tilt 3D são movidos por mouse — inúteis no touch de qualquer forma.
    const coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches
    const smallScreen = window.matchMedia('(max-width: 640px)').matches
    const deviceMem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    const lowMem = typeof deviceMem === 'number' && deviceMem <= 4
    const lite = reduce || coarse || smallScreen || lowMem
    const root = document.querySelector('.althos-home')
    if (!root) return
    const cleanups: Array<() => void> = []

    /* reveal on scroll-in (stagger via data-d) */
    {
      const items = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
      if (reduce) {
        items.forEach(el => el.classList.add('in'))
      } else {
        const io = new IntersectionObserver((entries) => {
          entries.forEach(e => {
            if (e.isIntersecting) {
              const el = e.target as HTMLElement
              const d = parseInt(el.getAttribute('data-d') || '0', 10)
              el.style.transitionDelay = `${d * 90}ms`
              el.classList.add('in')
              io.unobserve(el)
            }
          })
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
        items.forEach(el => io.observe(el))
        cleanups.push(() => io.disconnect())
      }
    }

    /* stats count-up */
    {
      const nums = Array.from(root.querySelectorAll<HTMLElement>('.stat-num'))
      const render = (el: HTMLElement, val: number) => {
        const prefix = el.getAttribute('data-prefix') || ''
        const unit = el.getAttribute('data-unit') || ''
        el.innerHTML = `${prefix}${val}<span class="unit">${unit}</span>`
      }
      const run = (el: HTMLElement) => {
        const target = parseInt(el.getAttribute('data-target') || '0', 10)
        if (reduce) { render(el, target); return }
        const dur = 1500
        let start: number | null = null
        const ease = (t: number) => 1 - Math.pow(1 - t, 3)
        const step = (ts: number) => {
          if (start === null) start = ts
          const p = Math.min((ts - start) / dur, 1)
          render(el, Math.round(ease(p) * target))
          if (p < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { run(e.target as HTMLElement); io.unobserve(e.target) } })
      }, { threshold: 0.5 })
      nums.forEach(el => io.observe(el))
      cleanups.push(() => io.disconnect())
    }

    /* features — mobile: accordion (tap abre + troca imagem);
       desktop: sticky scroll-driven activation */
    {
      const steps = Array.from(root.querySelectorAll<HTMLElement>('.feat-step'))
      const shots = Array.from(root.querySelectorAll<HTMLImageElement>('#featShots img'))
      if (steps.length && shots.length) {
        const isMobile = window.matchMedia('(max-width: 640px)').matches
        const activate = (shot: string | null) => {
          steps.forEach(s => s.classList.toggle('active', s.getAttribute('data-shot') === shot))
          shots.forEach(img => img.classList.toggle('active', img.getAttribute('data-shot') === shot))
        }
        if (isMobile) {
          const setOpen = (idx: number) => {
            steps.forEach((s, i) => s.classList.toggle('open', i === idx))
            activate(steps[idx].getAttribute('data-shot'))
          }
          steps.forEach((s, i) => {
            const onClick = (e: Event) => {
              // deixa o link "saiba mais" navegar sem reabrir
              if ((e.target as HTMLElement).closest('.learn')) return
              setOpen(i)
            }
            s.addEventListener('click', onClick)
            cleanups.push(() => s.removeEventListener('click', onClick))
          })
          setOpen(0)
        } else {
          activate(steps[0].getAttribute('data-shot'))
          const io = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) activate((e.target as HTMLElement).getAttribute('data-shot')) })
          }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 })
          steps.forEach(s => io.observe(s))
          cleanups.push(() => io.disconnect())
        }
      }
    }

    /* cursor spotlight */
    if (!lite) {
      const cards = Array.from(root.querySelectorAll<HTMLElement>('.spot'))
      cards.forEach(card => {
        const onMove = (e: MouseEvent) => {
          const r = card.getBoundingClientRect()
          card.style.setProperty('--mx', `${e.clientX - r.left}px`)
          card.style.setProperty('--my', `${e.clientY - r.top}px`)
        }
        card.addEventListener('mousemove', onMove)
        cleanups.push(() => card.removeEventListener('mousemove', onMove))
      })
    }

    /* 3D tilt on hero mockup */
    if (!lite) {
      const wrap = root.querySelector<HTMLElement>('.mock-wrap')
      const card = root.querySelector<HTMLElement>('#browser')
      if (wrap && card) {
        let raf: number | null = null, tx = 0, ty = 0, cx = 0, cy = 0
        const MAX = 4
        const tick = () => {
          cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12
          card.style.transform = `rotateX(${cx.toFixed(2)}deg) rotateY(${cy.toFixed(2)}deg)`
          if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) raf = requestAnimationFrame(tick)
          else raf = null
        }
        const onMove = (e: MouseEvent) => {
          const r = wrap.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width - 0.5
          const py = (e.clientY - r.top) / r.height - 0.5
          tx = -py * MAX; ty = px * MAX
          if (!raf) raf = requestAnimationFrame(tick)
        }
        const reset = () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tick) }
        window.addEventListener('mousemove', onMove, { passive: true })
        wrap.addEventListener('mouseleave', reset)
        cleanups.push(() => { window.removeEventListener('mousemove', onMove); wrap.removeEventListener('mouseleave', reset); if (raf) cancelAnimationFrame(raf) })
      }
    }

    /* AI typewriter */
    {
      const el = root.querySelector<HTMLElement>('#aiTyping')
      if (el) {
        const phrases = [
          'qualificando 3 novos leads…',
          'agendando follow-up para amanhã, 9h…',
          'lead quente detectado: prioridade alta…',
          'gerando relatório semanal de conversão…',
        ]
        if (reduce) {
          el.textContent = phrases[0]
        } else {
          let pi = 0, ci = 0, deleting = false, timer = 0
          const tick = () => {
            const p = phrases[pi]
            ci += deleting ? -1 : 1
            el.textContent = p.slice(0, ci)
            let delay = deleting ? 28 : 52
            if (!deleting && ci === p.length) { deleting = true; delay = 1500 }
            else if (deleting && ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; delay = 350 }
            timer = window.setTimeout(tick, delay)
          }
          tick()
          cleanups.push(() => clearTimeout(timer))
        }
      }
    }

    /* AI sparkles canvas */
    if (!lite) {
      const canvas = root.querySelector<HTMLCanvasElement>('#aiSparkles')
      const section = canvas?.closest<HTMLElement>('.ai')
      const ctx = canvas?.getContext('2d')
      if (canvas && section && ctx) {
        let dots: Array<{ x: number; y: number; r: number; a: number; sp: number; vy: number }> = []
        let W = 0, H = 0, raf: number | null = null
        const resize = () => {
          const r = section.getBoundingClientRect()
          W = canvas.width = r.width; H = canvas.height = r.height
          const n = Math.min(48, Math.round((W * H) / 34000))
          dots = []
          for (let i = 0; i < n; i++) dots.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4, a: Math.random(), sp: Math.random() * 0.02 + 0.005, vy: -(Math.random() * 0.25 + 0.05) })
        }
        const draw = () => {
          ctx.clearRect(0, 0, W, H)
          for (const d of dots) {
            d.a += d.sp; d.y += d.vy
            if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W }
            const o = (Math.sin(d.a) * 0.5 + 0.5) * 0.7
            ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(99,102,241,${o.toFixed(3)})`
            ctx.fill()
          }
          raf = requestAnimationFrame(draw)
        }
        resize()
        window.addEventListener('resize', resize)
        const io = new IntersectionObserver((e) => {
          if (e[0].isIntersecting) { if (!raf) draw() }
          else if (raf) { cancelAnimationFrame(raf); raf = null }
        }, { threshold: 0 })
        io.observe(section)
        cleanups.push(() => { window.removeEventListener('resize', resize); io.disconnect(); if (raf) cancelAnimationFrame(raf) })
      }
    }

    return () => { cleanups.forEach(fn => fn()) }
  }, [])

  return null
}
