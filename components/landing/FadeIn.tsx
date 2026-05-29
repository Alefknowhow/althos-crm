'use client'

import { motion, type Variants } from 'framer-motion'

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

const containerVariants: Variants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.1 } },
}

/** Wraps children in a fade+slide-up animation triggered when entering the viewport. */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={{
        hidden: { opacity: 0, y: 24 },
        show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Wraps a list of children and staggers their entrance. */
export function FadeInStagger({
  children,
  className,
  stagger = 0.1,
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  )
}

/** Individual staggered child — must be inside FadeInStagger. */
export function FadeInItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={defaultVariants}>
      {children}
    </motion.div>
  )
}
