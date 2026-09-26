import { describe, it, expect } from 'vitest'
import { normalizeIncludedKeys, enabledProductKinds, includedKeyForKind } from '@/lib/travel/product-types'

describe('normalizeIncludedKeys', () => {
  it('reconhece chaves atuais sem alteração', () => {
    const keys = normalizeIncludedKeys(['voos', 'hospedagem'], [])
    expect(Array.from(keys).sort()).toEqual(['hospedagem', 'voos'])
  })

  it('reconhece rótulos legados de texto livre (maiúsculas/acentos)', () => {
    const keys = normalizeIncludedKeys(['Aéreo ida e volta', 'Seguro viagem', 'Transfer aeroporto ⇄ hotel'], [])
    expect(Array.from(keys).sort()).toEqual(['seguro', 'transfer', 'voos'])
  })

  it('ignora texto livre não reconhecido', () => {
    const keys = normalizeIncludedKeys(['Taxas e impostos', 'voos'], [])
    expect(Array.from(keys)).toEqual(['voos'])
  })

  it('traduz o legado services (transfer/insurance/car_rental)', () => {
    const keys = normalizeIncludedKeys([], ['transfer', 'insurance', 'car_rental'])
    expect(Array.from(keys).sort()).toEqual(['carros', 'seguro', 'transfer'])
  })

  it('lista vazia retorna set vazio', () => {
    expect(normalizeIncludedKeys([], []).size).toBe(0)
    expect(normalizeIncludedKeys(null, null).size).toBe(0)
  })
})

describe('enabledProductKinds', () => {
  it('mapeia chaves canônicas pros tipos de produto', () => {
    const kinds = enabledProductKinds(['voos', 'carros'], [])
    expect(Array.from(kinds).sort()).toEqual(['aereo', 'veiculo'])
  })

  it('nada marcado retorna set vazio (regra 2 do C.2b: sem filtro)', () => {
    expect(enabledProductKinds([], []).size).toBe(0)
  })

  it('reconhece rótulo legado de passeios/ingressos', () => {
    const kinds = enabledProductKinds(['Passeio de barco', 'Ingresso parque'], [])
    expect(Array.from(kinds).sort()).toEqual(['ingresso', 'passeio'])
  })
})

describe('includedKeyForKind', () => {
  it('é o inverso de enabledProductKinds pra cada tipo', () => {
    expect(includedKeyForKind('aereo')).toBe('voos')
    expect(includedKeyForKind('outro')).toBe('servicos')
    expect(includedKeyForKind('veiculo')).toBe('carros')
  })
})
