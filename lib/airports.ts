/**
 * Sigla IATA → cidade (+ país quando não é Brasil). Usado pelo editor de
 * Cotações pra auto-preencher a cidade do trecho aéreo a partir da sigla
 * digitada — o vendedor só digita o código, a cidade nunca é editada
 * manualmente (ela só aparece no link público/impressão). Não é uma base
 * IATA completa; cobre os aeroportos brasileiros com voos regulares e os
 * destinos internacionais mais comuns pra uma agência de viagens.
 */
export const AIRPORTS: Record<string, { city: string; country?: string }> = {
  // Brasil
  GRU: { city: 'São Paulo' }, CGH: { city: 'São Paulo' }, VCP: { city: 'Campinas' },
  GIG: { city: 'Rio de Janeiro' }, SDU: { city: 'Rio de Janeiro' },
  BSB: { city: 'Brasília' }, CNF: { city: 'Belo Horizonte' }, PLU: { city: 'Belo Horizonte' },
  SSA: { city: 'Salvador' }, REC: { city: 'Recife' }, FOR: { city: 'Fortaleza' },
  POA: { city: 'Porto Alegre' }, CWB: { city: 'Curitiba' }, FLN: { city: 'Florianópolis' },
  VIX: { city: 'Vitória' }, BEL: { city: 'Belém' }, MAO: { city: 'Manaus' },
  GYN: { city: 'Goiânia' }, CGB: { city: 'Cuiabá' }, CGR: { city: 'Campo Grande' },
  SLZ: { city: 'São Luís' }, NAT: { city: 'Natal' }, JPA: { city: 'João Pessoa' },
  MCZ: { city: 'Maceió' }, AJU: { city: 'Aracaju' }, THE: { city: 'Teresina' },
  IGU: { city: 'Foz do Iguaçu' }, JOI: { city: 'Joinville' }, NVT: { city: 'Navegantes' },
  IOS: { city: 'Ilhéus' }, PVH: { city: 'Porto Velho' }, RBR: { city: 'Rio Branco' },
  BVB: { city: 'Boa Vista' }, MCP: { city: 'Macapá' }, PMW: { city: 'Palmas' },
  UDI: { city: 'Uberlândia' }, LDB: { city: 'Londrina' }, MGF: { city: 'Maringá' },
  BPS: { city: 'Porto Seguro' }, CZS: { city: 'Cruzeiro do Sul' },
  // América do Sul
  EZE: { city: 'Buenos Aires', country: 'Argentina' }, AEP: { city: 'Buenos Aires', country: 'Argentina' },
  SCL: { city: 'Santiago', country: 'Chile' }, LIM: { city: 'Lima', country: 'Peru' },
  BOG: { city: 'Bogotá', country: 'Colômbia' }, UIO: { city: 'Quito', country: 'Equador' },
  MVD: { city: 'Montevidéu', country: 'Uruguai' }, ASU: { city: 'Assunção', country: 'Paraguai' },
  CUZ: { city: 'Cusco', country: 'Peru' }, GYE: { city: 'Guayaquil', country: 'Equador' },
  // América Central / Caribe
  CUN: { city: 'Cancún', country: 'México' }, MEX: { city: 'Cidade do México', country: 'México' },
  PUJ: { city: 'Punta Cana', country: 'República Dominicana' }, SDQ: { city: 'Santo Domingo', country: 'República Dominicana' },
  HAV: { city: 'Havana', country: 'Cuba' }, NAS: { city: 'Nassau', country: 'Bahamas' },
  PTY: { city: 'Cidade do Panamá', country: 'Panamá' }, SJO: { city: 'San José', country: 'Costa Rica' },
  AUA: { city: 'Aruba', country: 'Aruba' }, CUR: { city: 'Curaçao', country: 'Curaçao' },
  MBJ: { city: 'Montego Bay', country: 'Jamaica' }, SJU: { city: 'San Juan', country: 'Porto Rico' },
  // América do Norte
  MIA: { city: 'Miami', country: 'EUA' }, MCO: { city: 'Orlando', country: 'EUA' },
  JFK: { city: 'Nova York', country: 'EUA' }, EWR: { city: 'Nova York', country: 'EUA' },
  LAX: { city: 'Los Angeles', country: 'EUA' }, LAS: { city: 'Las Vegas', country: 'EUA' },
  FLL: { city: 'Fort Lauderdale', country: 'EUA' }, ATL: { city: 'Atlanta', country: 'EUA' },
  IAH: { city: 'Houston', country: 'EUA' }, ORD: { city: 'Chicago', country: 'EUA' },
  SFO: { city: 'São Francisco', country: 'EUA' }, YYZ: { city: 'Toronto', country: 'Canadá' },
  YUL: { city: 'Montreal', country: 'Canadá' },
  // Europa
  LIS: { city: 'Lisboa', country: 'Portugal' }, OPO: { city: 'Porto', country: 'Portugal' },
  MAD: { city: 'Madri', country: 'Espanha' }, BCN: { city: 'Barcelona', country: 'Espanha' },
  CDG: { city: 'Paris', country: 'França' }, ORY: { city: 'Paris', country: 'França' },
  LHR: { city: 'Londres', country: 'Reino Unido' }, LGW: { city: 'Londres', country: 'Reino Unido' },
  FCO: { city: 'Roma', country: 'Itália' }, MXP: { city: 'Milão', country: 'Itália' },
  AMS: { city: 'Amsterdã', country: 'Holanda' }, FRA: { city: 'Frankfurt', country: 'Alemanha' },
  MUC: { city: 'Munique', country: 'Alemanha' }, ZRH: { city: 'Zurique', country: 'Suíça' },
  VIE: { city: 'Viena', country: 'Áustria' }, ATH: { city: 'Atenas', country: 'Grécia' },
  IST: { city: 'Istambul', country: 'Turquia' }, DUB: { city: 'Dublin', country: 'Irlanda' },
  // Oriente Médio / Ásia / Oceania
  DXB: { city: 'Dubai', country: 'Emirados Árabes' }, DOH: { city: 'Doha', country: 'Catar' },
  NRT: { city: 'Tóquio', country: 'Japão' }, HND: { city: 'Tóquio', country: 'Japão' },
  ICN: { city: 'Seul', country: 'Coreia do Sul' }, SIN: { city: 'Singapura', country: 'Singapura' },
  BKK: { city: 'Bangcoc', country: 'Tailândia' }, SYD: { city: 'Sydney', country: 'Austrália' },
  // África
  JNB: { city: 'Joanesburgo', country: 'África do Sul' }, CPT: { city: 'Cidade do Cabo', country: 'África do Sul' },
}

/** Cidade a partir da sigla (case-insensitive) — retorna null se a sigla
 *  não estiver na base (o campo de cidade simplesmente não aparece nesse
 *  caso, em vez de mostrar algo errado). */
export function cityFromAirportCode(code?: string | null): string | null {
  if (!code) return null
  const entry = AIRPORTS[code.trim().toUpperCase()]
  return entry ? entry.city : null
}
