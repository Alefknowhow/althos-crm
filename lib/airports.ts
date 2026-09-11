/**
 * Sigla IATA → cidade (+ país quando não é Brasil) + coordenada. Usado pelo
 * editor de Cotações pra auto-preencher a cidade do trecho aéreo a partir
 * da sigla digitada — o vendedor só digita o código, a cidade nunca é
 * editada manualmente (ela só aparece no link público/impressão). A
 * coordenada alimenta o Mapa de rota de voos (`lib/geo/flightRoute.ts`).
 * Não é uma base IATA completa; cobre os aeroportos brasileiros com voos
 * regulares e os destinos internacionais mais comuns pra uma agência de
 * viagens.
 */
export const AIRPORTS: Record<string, { city: string; country?: string; lat: number; lng: number }> = {
  // Brasil
  GRU: { city: 'São Paulo', lat: -23.4356, lng: -46.4731 }, CGH: { city: 'São Paulo', lat: -23.6273, lng: -46.6566 }, VCP: { city: 'Campinas', lat: -23.0074, lng: -47.1345 },
  GIG: { city: 'Rio de Janeiro', lat: -22.8099, lng: -43.2505 }, SDU: { city: 'Rio de Janeiro', lat: -22.9105, lng: -43.1634 },
  BSB: { city: 'Brasília', lat: -15.8697, lng: -47.9208 }, CNF: { city: 'Belo Horizonte', lat: -19.6244, lng: -43.9719 }, PLU: { city: 'Belo Horizonte', lat: -19.8512, lng: -43.9506 },
  SSA: { city: 'Salvador', lat: -12.9086, lng: -38.3225 }, REC: { city: 'Recife', lat: -8.1264, lng: -34.9236 }, FOR: { city: 'Fortaleza', lat: -3.7763, lng: -38.5326 },
  POA: { city: 'Porto Alegre', lat: -29.9944, lng: -51.1714 }, CWB: { city: 'Curitiba', lat: -25.5285, lng: -49.1758 }, FLN: { city: 'Florianópolis', lat: -27.6705, lng: -48.5477 },
  VIX: { city: 'Vitória', lat: -20.258, lng: -40.2864 }, BEL: { city: 'Belém', lat: -1.3792, lng: -48.4763 }, MAO: { city: 'Manaus', lat: -3.0386, lng: -60.0497 },
  GYN: { city: 'Goiânia', lat: -16.632, lng: -49.2207 }, CGB: { city: 'Cuiabá', lat: -15.6529, lng: -56.1167 }, CGR: { city: 'Campo Grande', lat: -20.4687, lng: -54.6725 },
  SLZ: { city: 'São Luís', lat: -2.5852, lng: -44.2341 }, NAT: { city: 'Natal', lat: -5.7681, lng: -35.3768 }, JPA: { city: 'João Pessoa', lat: -7.1466, lng: -34.9508 },
  MCZ: { city: 'Maceió', lat: -9.5108, lng: -35.7917 }, AJU: { city: 'Aracaju', lat: -10.984, lng: -37.0704 }, THE: { city: 'Teresina', lat: -5.0599, lng: -42.8236 },
  IGU: { city: 'Foz do Iguaçu', lat: -25.6002, lng: -54.485 }, JOI: { city: 'Joinville', lat: -26.2245, lng: -48.7972 }, NVT: { city: 'Navegantes', lat: -26.8797, lng: -48.6514 },
  IOS: { city: 'Ilhéus', lat: -14.816, lng: -39.033 }, PVH: { city: 'Porto Velho', lat: -8.7093, lng: -63.9022 }, RBR: { city: 'Rio Branco', lat: -9.8688, lng: -67.8998 },
  BVB: { city: 'Boa Vista', lat: 2.8412, lng: -60.69 }, MCP: { city: 'Macapá', lat: 0.0506, lng: -51.0722 }, PMW: { city: 'Palmas', lat: -10.2915, lng: -48.3572 },
  UDI: { city: 'Uberlândia', lat: -18.8836, lng: -48.2251 }, LDB: { city: 'Londrina', lat: -23.3336, lng: -51.1301 }, MGF: { city: 'Maringá', lat: -23.4762, lng: -52.0086 },
  BPS: { city: 'Porto Seguro', lat: -16.438, lng: -39.0808 }, CZS: { city: 'Cruzeiro do Sul', lat: -7.5983, lng: -72.7692 },
  // América do Sul
  EZE: { city: 'Buenos Aires', country: 'Argentina', lat: -34.8222, lng: -58.5358 }, AEP: { city: 'Buenos Aires', country: 'Argentina', lat: -34.5592, lng: -58.4156 },
  SCL: { city: 'Santiago', country: 'Chile', lat: -33.393, lng: -70.7858 }, LIM: { city: 'Lima', country: 'Peru', lat: -12.0219, lng: -77.1143 },
  BOG: { city: 'Bogotá', country: 'Colômbia', lat: 4.7016, lng: -74.1469 }, UIO: { city: 'Quito', country: 'Equador', lat: -0.1292, lng: -78.3575 },
  MVD: { city: 'Montevidéu', country: 'Uruguai', lat: -34.8384, lng: -56.0308 }, ASU: { city: 'Assunção', country: 'Paraguai', lat: -25.24, lng: -57.52 },
  CUZ: { city: 'Cusco', country: 'Peru', lat: -13.5358, lng: -71.9389 }, GYE: { city: 'Guayaquil', country: 'Equador', lat: -2.1574, lng: -79.8836 },
  // América Central / Caribe
  CUN: { city: 'Cancún', country: 'México', lat: 21.0365, lng: -86.8771 }, MEX: { city: 'Cidade do México', country: 'México', lat: 19.4363, lng: -99.0721 },
  PUJ: { city: 'Punta Cana', country: 'República Dominicana', lat: 18.5674, lng: -68.3634 }, SDQ: { city: 'Santo Domingo', country: 'República Dominicana', lat: 18.4297, lng: -69.6689 },
  HAV: { city: 'Havana', country: 'Cuba', lat: 22.9892, lng: -82.4091 }, NAS: { city: 'Nassau', country: 'Bahamas', lat: 25.0389, lng: -77.4662 },
  PTY: { city: 'Cidade do Panamá', country: 'Panamá', lat: 9.0714, lng: -79.3835 }, SJO: { city: 'San José', country: 'Costa Rica', lat: 9.9939, lng: -84.2088 },
  AUA: { city: 'Aruba', country: 'Aruba', lat: 12.5014, lng: -70.0152 }, CUR: { city: 'Curaçao', country: 'Curaçao', lat: 12.1889, lng: -68.9598 },
  MBJ: { city: 'Montego Bay', country: 'Jamaica', lat: 18.5037, lng: -77.9134 }, SJU: { city: 'San Juan', country: 'Porto Rico', lat: 18.4394, lng: -66.0018 },
  // América do Norte
  MIA: { city: 'Miami', country: 'EUA', lat: 25.7959, lng: -80.287 }, MCO: { city: 'Orlando', country: 'EUA', lat: 28.4312, lng: -81.3081 },
  JFK: { city: 'Nova York', country: 'EUA', lat: 40.6413, lng: -73.7781 }, EWR: { city: 'Nova York', country: 'EUA', lat: 40.6895, lng: -74.1745 },
  LAX: { city: 'Los Angeles', country: 'EUA', lat: 33.9416, lng: -118.4085 }, LAS: { city: 'Las Vegas', country: 'EUA', lat: 36.084, lng: -115.1537 },
  FLL: { city: 'Fort Lauderdale', country: 'EUA', lat: 26.0742, lng: -80.1506 }, ATL: { city: 'Atlanta', country: 'EUA', lat: 33.6407, lng: -84.4277 },
  IAH: { city: 'Houston', country: 'EUA', lat: 29.9902, lng: -95.3368 }, ORD: { city: 'Chicago', country: 'EUA', lat: 41.9742, lng: -87.9073 },
  SFO: { city: 'São Francisco', country: 'EUA', lat: 37.6213, lng: -122.379 }, YYZ: { city: 'Toronto', country: 'Canadá', lat: 43.6777, lng: -79.6248 },
  YUL: { city: 'Montreal', country: 'Canadá', lat: 45.4706, lng: -73.7408 },
  // Europa
  LIS: { city: 'Lisboa', country: 'Portugal', lat: 38.7756, lng: -9.1354 }, OPO: { city: 'Porto', country: 'Portugal', lat: 41.2481, lng: -8.6814 },
  MAD: { city: 'Madri', country: 'Espanha', lat: 40.4983, lng: -3.5676 }, BCN: { city: 'Barcelona', country: 'Espanha', lat: 41.2974, lng: 2.0833 },
  CDG: { city: 'Paris', country: 'França', lat: 49.0097, lng: 2.5479 }, ORY: { city: 'Paris', country: 'França', lat: 48.7233, lng: 2.3794 },
  LHR: { city: 'Londres', country: 'Reino Unido', lat: 51.47, lng: -0.4543 }, LGW: { city: 'Londres', country: 'Reino Unido', lat: 51.1537, lng: -0.1821 },
  FCO: { city: 'Roma', country: 'Itália', lat: 41.8003, lng: 12.2389 }, MXP: { city: 'Milão', country: 'Itália', lat: 45.6306, lng: 8.7281 },
  AMS: { city: 'Amsterdã', country: 'Holanda', lat: 52.3105, lng: 4.7683 }, FRA: { city: 'Frankfurt', country: 'Alemanha', lat: 50.0379, lng: 8.5622 },
  MUC: { city: 'Munique', country: 'Alemanha', lat: 48.3538, lng: 11.7861 }, ZRH: { city: 'Zurique', country: 'Suíça', lat: 47.4647, lng: 8.5492 },
  VIE: { city: 'Viena', country: 'Áustria', lat: 48.1103, lng: 16.5697 }, ATH: { city: 'Atenas', country: 'Grécia', lat: 37.9364, lng: 23.9445 },
  IST: { city: 'Istambul', country: 'Turquia', lat: 41.2753, lng: 28.7519 }, DUB: { city: 'Dublin', country: 'Irlanda', lat: 53.4213, lng: -6.2701 },
  // Oriente Médio / Ásia / Oceania
  DXB: { city: 'Dubai', country: 'Emirados Árabes', lat: 25.2532, lng: 55.3657 }, DOH: { city: 'Doha', country: 'Catar', lat: 25.2609, lng: 51.6138 },
  NRT: { city: 'Tóquio', country: 'Japão', lat: 35.7719, lng: 140.3928 }, HND: { city: 'Tóquio', country: 'Japão', lat: 35.5494, lng: 139.7798 },
  ICN: { city: 'Seul', country: 'Coreia do Sul', lat: 37.4602, lng: 126.4407 }, SIN: { city: 'Singapura', country: 'Singapura', lat: 1.3644, lng: 103.9915 },
  BKK: { city: 'Bangcoc', country: 'Tailândia', lat: 13.69, lng: 100.7501 }, SYD: { city: 'Sydney', country: 'Austrália', lat: -33.9399, lng: 151.1753 },
  // África
  JNB: { city: 'Joanesburgo', country: 'África do Sul', lat: -26.1392, lng: 28.246 }, CPT: { city: 'Cidade do Cabo', country: 'África do Sul', lat: -33.9715, lng: 18.6021 },
}

/** Cidade a partir da sigla (case-insensitive) — retorna null se a sigla
 *  não estiver na base (o campo de cidade simplesmente não aparece nesse
 *  caso, em vez de mostrar algo errado). */
export function cityFromAirportCode(code?: string | null): string | null {
  if (!code) return null
  const entry = AIRPORTS[code.trim().toUpperCase()]
  return entry ? entry.city : null
}

/** Dados completos (cidade/país/coordenada) a partir da sigla — usado pelo
 *  Mapa de rota de voos pra plotar cada trecho. */
export function airportFromCode(code?: string | null) {
  if (!code) return null
  return AIRPORTS[code.trim().toUpperCase()] ?? null
}
