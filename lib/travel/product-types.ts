// Mapa central de tipos de produto de venda (issue #59/#60, Fase C.2b/C.3) —
// ícone/cor/label pra aba Produtos redesenhada (C.3) e a regra "produtos
// habilitados conforme o checklist de Dados da reserva" (C.2b). Puro, sem
// I/O — usado tanto no client (UI) quanto em testes.

import {
  Plane, Hotel, Car, Ship, ShieldCheck, Ticket, MapPinned, Package,
  type LucideIcon,
} from 'lucide-react'
import type { SaleProductKind } from '@/actions/sale-products'

// Réplica só das CHAVES de INCLUDED_ITEMS (TravelSalesViewShared.tsx) — não
// importa de lá porque esse arquivo é 'use client' e este módulo também é
// usado por actions 'use server' (ensureIncludedForProductKind); importar um
// módulo client num arquivo server quebra o build de produção (mesma classe
// de bug já corrigida em actions/marketing-drilldown.ts). Se a lista de
// chaves mudar lá, mudar aqui também (coberto por teste em ambos os lados).
const KNOWN_INCLUDED_KEYS_LIST = ['voos', 'hospedagem', 'transfer', 'cruzeiros', 'seguro', 'passeios', 'carros', 'ingressos', 'servicos']

export type ProductKindMeta = {
  kind: SaleProductKind
  label: string
  icon: LucideIcon
  /** Cor de identificação da categoria — única exceção ao uso de tokens do
   *  Design System (aprovado no plano da issue #60 Fase C.3). */
  color: string
  /** Chave canônica correspondente em INCLUDED_ITEMS (aba Dados). */
  includedKey: string
}

export const PRODUCT_KIND_META: Record<SaleProductKind, ProductKindMeta> = {
  aereo:       { kind: 'aereo',       label: 'Aéreo',              icon: Plane,       color: '#2563eb', includedKey: 'voos' },
  hospedagem:  { kind: 'hospedagem',  label: 'Hospedagem',         icon: Hotel,       color: '#16a34a', includedKey: 'hospedagem' },
  transfer:    { kind: 'transfer',    label: 'Transfer',           icon: Car,         color: '#f97316', includedKey: 'transfer' },
  cruzeiro:    { kind: 'cruzeiro',    label: 'Cruzeiro',           icon: Ship,        color: '#06b6d4', includedKey: 'cruzeiros' },
  seguro:      { kind: 'seguro',      label: 'Seguro viagem',      icon: ShieldCheck, color: '#db2777', includedKey: 'seguro' },
  passeio:     { kind: 'passeio',     label: 'Passeio',            icon: MapPinned,   color: '#9333ea', includedKey: 'passeios' },
  ingresso:    { kind: 'ingresso',    label: 'Ingresso',           icon: Ticket,      color: '#9333ea', includedKey: 'ingressos' },
  veiculo:     { kind: 'veiculo',     label: 'Locação de veículo', icon: Car,         color: '#f97316', includedKey: 'carros' },
  outro:       { kind: 'outro',       label: 'Outro',              icon: Package,     color: '#64748b', includedKey: 'servicos' },
}

const KNOWN_INCLUDED_KEYS = new Set(KNOWN_INCLUDED_KEYS_LIST)

const INCLUDED_KEY_TO_KIND: Record<string, SaleProductKind> = {
  voos: 'aereo', hospedagem: 'hospedagem', transfer: 'transfer', cruzeiros: 'cruzeiro',
  seguro: 'seguro', passeios: 'passeio', carros: 'veiculo', ingressos: 'ingresso', servicos: 'outro',
}

/** Legado `travel_sales.services` (transfer/insurance/car_rental) → chave
 *  canônica de included_items. */
const SERVICE_TO_INCLUDED_KEY: Record<string, string> = {
  transfer: 'transfer', insurance: 'seguro', car_rental: 'carros',
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalizeText(s: string): string {
  return stripAccents(s).toLowerCase().trim()
}

// Reconhece rótulos de texto livre de versões antigas do checklist "O que
// está incluso" (produção tem itens como "Aéreo ida e volta", "Seguro
// viagem", "Transfer aeroporto ⇄ hotel") — ordem importa (mais específico
// primeiro não é necessário aqui, os prefixos não colidem entre si).
const LEGACY_LABEL_PATTERNS: [RegExp, string][] = [
  [/^(aereo|voo)/, 'voos'],
  [/^hospedagem/, 'hospedagem'],
  [/^(transfer|traslado)/, 'transfer'],
  [/^seguro/, 'seguro'],
  [/^cruzeiro/, 'cruzeiros'],
  [/^passeio/, 'passeios'],
  [/^ingresso/, 'ingressos'],
  [/^(locacao|carro)/, 'carros'],
]

/**
 * Normaliza `included_items` (chaves atuais + rótulos de texto livre
 * legados) e `services` (legado `transfer`/`insurance`/`car_rental`) pras
 * chaves canônicas de INCLUDED_ITEMS. Texto livre não reconhecido é
 * simplesmente ignorado pela regra — **nunca** reescrito no banco por causa
 * disso (quem chama essa função só lê, nunca persiste o resultado de volta
 * em included_items).
 */
export function normalizeIncludedKeys(included: string[] | null | undefined, services: string[] | null | undefined): Set<string> {
  const result = new Set<string>()
  for (const raw of included || []) {
    if (!raw) continue
    if (KNOWN_INCLUDED_KEYS.has(raw)) { result.add(raw); continue }
    const norm = normalizeText(raw)
    const match = LEGACY_LABEL_PATTERNS.find(([re]) => re.test(norm))
    if (match) result.add(match[1])
  }
  for (const svc of services || []) {
    const key = SERVICE_TO_INCLUDED_KEY[svc]
    if (key) result.add(key)
  }
  return result
}

/** Tipos de produto habilitados a partir do checklist "O que está incluso"
 *  (aba Dados) + legado `services`. Vazio quando nada está marcado — quem
 *  consome isso trata esse caso como "sem filtro" (regra 2 do C.2b). */
export function enabledProductKinds(included: string[] | null | undefined, services: string[] | null | undefined): Set<SaleProductKind> {
  const keys = normalizeIncludedKeys(included, services)
  const kinds = new Set<SaleProductKind>()
  for (const key of Array.from(keys)) {
    const kind = INCLUDED_KEY_TO_KIND[key]
    if (kind) kinds.add(kind)
  }
  return kinds
}

/** Chave canônica de included_items pro tipo de produto — usado tanto pra
 *  marcar "Habilitar em Dados" quanto pra sincronização inversa ao criar um
 *  produto de um tipo ainda não marcado. */
export function includedKeyForKind(kind: SaleProductKind): string {
  return PRODUCT_KIND_META[kind].includedKey
}
