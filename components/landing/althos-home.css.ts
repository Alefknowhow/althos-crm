/**
 * CSS escopado da landing AlthosHome. TODAS as regras são prefixadas com
 * `.althos-home` (sem resets globais `*`/`body`) para não vazar para o
 * header/footer (SiteShell) nem para outras páginas.
 *
 * Tema ESCURO Carbon g100: fundo quase preto, muito respiro, tipografia
 * grotesk, superfícies brancas com sombras suaves, gradientes pastel
 * discretos e acento AZUL Carbon da Althos (#0f62fe).
 *
 * Split across three parts (pure string data, split at rule boundaries —
 * concatenation order matters, content unchanged):
 *   - althos-home.css-1.ts: base/tokens through .solutions
 *   - althos-home.css-2.ts: features (legacy)/soluções/nichos/onboarding/final
 *   - althos-home.css-3.ts: GEO/FAQ/reveal animation
 */
import { HOME_CSS_1 } from './althos-home.css-1'
import { HOME_CSS_2 } from './althos-home.css-2'
import { HOME_CSS_3 } from './althos-home.css-3'

export const HOME_CSS = HOME_CSS_1 + HOME_CSS_2 + HOME_CSS_3
