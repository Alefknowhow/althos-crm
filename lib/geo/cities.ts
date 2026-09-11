/**
 * Cidades mais turísticas por país (ISO2), lat/lng fixos — sem geocoding
 * externo. Cobertura mais funda pros destinos mais comuns de agência BR;
 * países fora desta lista usam o centróide do país (ver countries.ts) e o
 * campo de cidade vira só um texto decorativo (não afeta posição no mapa).
 */

export type CityInfo = { name: string; lat: number; lng: number }

export const CITIES_BY_ISO2: Record<string, CityInfo[]> = {
  br: [
    { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
    { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
    { name: 'Florianópolis', lat: -27.5954, lng: -48.548 },
    { name: 'Salvador', lat: -12.9777, lng: -38.5016 },
    { name: 'Fortaleza', lat: -3.7319, lng: -38.5267 },
    { name: 'Recife', lat: -8.0476, lng: -34.877 },
    { name: 'Foz do Iguaçu', lat: -25.5478, lng: -54.5882 },
    { name: 'Gramado', lat: -29.3747, lng: -50.8767 },
    { name: 'Natal', lat: -5.7945, lng: -35.211 },
    { name: 'Porto de Galinhas', lat: -8.5106, lng: -35.0031 },
  ],
  pt: [
    { name: 'Lisboa', lat: 38.7223, lng: -9.1393 },
    { name: 'Porto', lat: 41.1579, lng: -8.6291 },
    { name: 'Faro (Algarve)', lat: 37.0194, lng: -7.9304 },
    { name: 'Funchal (Madeira)', lat: 32.6669, lng: -16.9241 },
    { name: 'Sintra', lat: 38.7972, lng: -9.3903 },
  ],
  es: [
    { name: 'Madri', lat: 40.4168, lng: -3.7038 },
    { name: 'Barcelona', lat: 41.3874, lng: 2.1686 },
    { name: 'Sevilha', lat: 37.3891, lng: -5.9845 },
    { name: 'Valência', lat: 39.4699, lng: -0.3763 },
    { name: 'Ibiza', lat: 38.9067, lng: 1.4206 },
    { name: 'Palma de Maiorca', lat: 39.5696, lng: 2.6502 },
  ],
  fr: [
    { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    { name: 'Nice', lat: 43.7102, lng: 7.262 },
    { name: 'Lyon', lat: 45.764, lng: 4.8357 },
    { name: 'Marselha', lat: 43.2965, lng: 5.3698 },
    { name: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
  ],
  it: [
    { name: 'Roma', lat: 41.9028, lng: 12.4964 },
    { name: 'Milão', lat: 45.4642, lng: 9.19 },
    { name: 'Veneza', lat: 45.4408, lng: 12.3155 },
    { name: 'Florença', lat: 43.7696, lng: 11.2558 },
    { name: 'Nápoles', lat: 40.8518, lng: 14.2681 },
    { name: 'Costa Amalfitana', lat: 40.6333, lng: 14.6029 },
  ],
  us: [
    { name: 'Nova York', lat: 40.7128, lng: -74.006 },
    { name: 'Miami', lat: 25.7617, lng: -80.1918 },
    { name: 'Orlando', lat: 28.5383, lng: -81.3792 },
    { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
    { name: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
    { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
    { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  ],
  ca: [
    { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
    { name: 'Vancouver', lat: 49.2827, lng: -123.1207 },
    { name: 'Montreal', lat: 45.5019, lng: -73.5674 },
    { name: 'Niagara Falls', lat: 43.0962, lng: -79.0377 },
  ],
  mx: [
    { name: 'Cancún', lat: 21.1619, lng: -86.8515 },
    { name: 'Cidade do México', lat: 19.4326, lng: -99.1332 },
    { name: 'Playa del Carmen', lat: 20.6296, lng: -87.0739 },
    { name: 'Tulum', lat: 20.2114, lng: -87.4654 },
    { name: 'Puerto Vallarta', lat: 20.6534, lng: -105.2253 },
  ],
  ar: [
    { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
    { name: 'Bariloche', lat: -41.1335, lng: -71.3103 },
    { name: 'Mendoza', lat: -32.8895, lng: -68.8458 },
    { name: 'Ushuaia', lat: -54.8019, lng: -68.303 },
  ],
  cl: [
    { name: 'Santiago', lat: -33.4489, lng: -70.6693 },
    { name: 'Ilha de Páscoa', lat: -27.1127, lng: -109.3497 },
    { name: 'Valparaíso', lat: -33.0472, lng: -71.6127 },
  ],
  gb: [
    { name: 'Londres', lat: 51.5072, lng: -0.1276 },
    { name: 'Edimburgo', lat: 55.9533, lng: -3.1883 },
    { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
  ],
  de: [
    { name: 'Berlim', lat: 52.52, lng: 13.405 },
    { name: 'Munique', lat: 48.1351, lng: 11.582 },
    { name: 'Frankfurt', lat: 50.1109, lng: 8.6821 },
  ],
  gr: [
    { name: 'Atenas', lat: 37.9838, lng: 23.7275 },
    { name: 'Santorini', lat: 36.3932, lng: 25.4615 },
    { name: 'Mykonos', lat: 37.4467, lng: 25.3289 },
  ],
  ae: [
    { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
    { name: 'Abu Dhabi', lat: 24.4539, lng: 54.3773 },
  ],
  jp: [
    { name: 'Tóquio', lat: 35.6762, lng: 139.6503 },
    { name: 'Quioto', lat: 35.0116, lng: 135.7681 },
    { name: 'Osaka', lat: 34.6937, lng: 135.5023 },
  ],
  th: [
    { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
    { name: 'Phuket', lat: 7.8804, lng: 98.3923 },
    { name: 'Chiang Mai', lat: 18.7883, lng: 98.9853 },
  ],
  mv: [
    { name: 'Malé', lat: 4.1755, lng: 73.5093 },
  ],
  au: [
    { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
    { name: 'Melbourne', lat: -37.8136, lng: 144.9631 },
    { name: 'Gold Coast', lat: -28.0167, lng: 153.4 },
  ],
  cu: [
    { name: 'Havana', lat: 23.1136, lng: -82.3666 },
    { name: 'Varadero', lat: 23.1394, lng: -81.2653 },
  ],
  eg: [
    { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
    { name: 'Sharm el-Sheikh', lat: 27.9158, lng: 34.33 },
  ],
}
