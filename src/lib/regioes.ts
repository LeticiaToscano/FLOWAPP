/**
 * Capas prontas por região (fotos hiper-realistas geradas no Higgsfield, misturando os principais pontos de cada região).
 * A região sai do destino e do nome da viagem: "Paris", "Itália", "Eurotrip" → Europa; "Nova York" → América do Norte…
 * Se não reconhecer, a viagem fica com a capa de sempre (foto do destino ou a padrão).
 */

export type Regiao = 'europa' | 'america-norte' | 'america-sul' | 'caribe' | 'asia' | 'oriente-medio' | 'africa' | 'oceania' | 'brasil'

const CDN = 'https://d2ol7oe51mr4n9.cloudfront.net/user_3Hrjdnb6LBzJK6SYxcNE6VQdZEf/'

export const CAPA_REGIAO: Record<Regiao, string> = {
  europa: CDN + '326f0fe0-8370-4ea1-bfc6-a21564b1e755.jpg',
  'america-norte': CDN + '4445e1e7-958b-41fb-b77e-8ea40d93f0ec.jpg',
  'america-sul': CDN + '30e272a3-f774-40e4-a260-08edde8caea0.jpg',
  caribe: CDN + '749261bf-7325-420b-bde8-675979f37a18.jpg',
  asia: CDN + 'ce5f311e-e7a9-4d71-bf24-a131d609c8a0.jpg',
  'oriente-medio': CDN + '24e0625d-60ea-48f0-b8ca-bf1e8c4a092a.jpg',
  africa: CDN + 'b50691d3-c27f-4746-80bf-10c14aa36082.jpg',
  oceania: CDN + '07ecf744-c3ca-4b33-9975-f9306f9f98b5.jpg',
  brasil: CDN + 'bbc91a9c-784a-48d0-b016-a857522e8f09.jpg',
}
export const NOME_REGIAO: Record<Regiao, string> = {
  europa: 'Europa', 'america-norte': 'América do Norte', 'america-sul': 'América do Sul', caribe: 'Caribe', asia: 'Ásia',
  'oriente-medio': 'Oriente Médio', africa: 'África', oceania: 'Oceania', brasil: 'Brasil',
}

// Palavras de cada região (sem acento, minúsculas). A ordem importa: Caribe e Oriente Médio antes dos continentes.
const PALAVRAS: [Regiao, string[]][] = [
  ['caribe', ['caribe', 'cancun', 'punta cana', 'aruba', 'curacao', 'bahamas', 'jamaica', 'cuba', 'havana', 'republica dominicana', 'porto rico', 'barbados', 'santa lucia', 'turks', 'riviera maya', 'tulum', 'playa del carmen', 'saint martin', 'st. martin', 'martinica', 'guadalupe', 'cozumel']],
  ['oriente-medio', ['dubai', 'abu dhabi', 'emirados', 'qatar', 'catar', 'doha', 'arabia', 'riad', 'jordania', 'petra', 'israel', 'jerusalem', 'tel aviv', 'omã', 'oma', 'mascate', 'bahrein', 'kuwait', 'libano', 'beirute', 'turquia', 'istambul', 'capadocia']],
  ['brasil', ['brasil', 'rio de janeiro', 'sao paulo', 'noronha', 'bahia', 'salvador', 'florianopolis', 'gramado', 'bonito', 'foz do iguacu', 'lencois', 'maceio', 'recife', 'natal', 'fortaleza', 'jericoacoara', 'porto de galinhas', 'buzios', 'paraty', 'trancoso', 'manaus', 'amazonia', 'pantanal', 'chapada', 'belo horizonte', 'curitiba', 'porto alegre', 'brasilia', 'ilhabela', 'arraial', 'morro de sao paulo', 'campos do jordao', 'angra']],
  ['europa', ['europa', 'eurotrip', 'euro trip', 'franca', 'paris', 'italia', 'roma', 'milao', 'veneza', 'florenca', 'toscana', 'amalfi', 'sicilia', 'espanha', 'madri', 'madrid', 'barcelona', 'sevilha', 'ibiza', 'portugal', 'lisboa', 'porto', 'algarve', 'madeira', 'acores', 'inglaterra', 'londres', 'reino unido', 'escocia', 'edimburgo', 'irlanda', 'dublin', 'alemanha', 'berlim', 'munique', 'holanda', 'amsterda', 'belgica', 'bruxelas', 'suica', 'zurique', 'genebra', 'alpes', 'austria', 'viena', 'grecia', 'atenas', 'santorini', 'mykonos', 'croacia', 'dubrovnik', 'praga', 'republica tcheca', 'hungria', 'budapeste', 'polonia', 'cracovia', 'noruega', 'oslo', 'suecia', 'estocolmo', 'dinamarca', 'copenhague', 'finlandia', 'islandia', 'reykjavik', 'monaco', 'malta', 'chipre', 'luxemburgo', 'leste europeu']],
  ['america-norte', ['estados unidos', 'eua', 'usa', 'nova york', 'new york', 'miami', 'orlando', 'disney', 'las vegas', 'los angeles', 'san francisco', 'chicago', 'boston', 'washington', 'havai', 'hawaii', 'california', 'florida', 'texas', 'canada', 'toronto', 'vancouver', 'montreal', 'quebec', 'mexico', 'cidade do mexico', 'alasca']],
  ['america-sul', ['argentina', 'buenos aires', 'bariloche', 'mendoza', 'patagonia', 'ushuaia', 'el calafate', 'chile', 'santiago', 'atacama', 'peru', 'lima', 'cusco', 'machu picchu', 'uruguai', 'montevideu', 'punta del este', 'colombia', 'bogota', 'cartagena', 'medellin', 'bolivia', 'uyuni', 'equador', 'galapagos', 'paraguai', 'venezuela', 'america do sul']],
  ['asia', ['asia', 'japao', 'toquio', 'kyoto', 'osaka', 'china', 'pequim', 'xangai', 'hong kong', 'coreia', 'seul', 'tailandia', 'bangkok', 'phuket', 'vietna', 'indonesia', 'bali', 'singapura', 'malasia', 'filipinas', 'india', 'maldivas', 'sri lanka', 'nepal', 'camboja', 'taiwan']],
  ['africa', ['africa', 'egito', 'cairo', 'marrocos', 'marrakech', 'africa do sul', 'cidade do cabo', 'quenia', 'tanzania', 'zanzibar', 'safari', 'serengeti', 'mauricio', 'seychelles', 'cabo verde', 'namibia', 'tunisia', 'madagascar']],
  ['oceania', ['oceania', 'australia', 'sydney', 'melbourne', 'nova zelandia', 'auckland', 'queenstown', 'fiji', 'bora bora', 'taiti', 'polinesia']],
]

const limpar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Descobre a região pelo destino e pelo nome da viagem. */
export function regiaoDe(...textos: (string | null | undefined)[]): Regiao | null {
  const t = ' ' + limpar(textos.filter(Boolean).join(' ')).replace(/[^a-z0-9. ]+/g, ' ') + ' '
  for (const [r, ps] of PALAVRAS) if (ps.some((p) => t.includes(' ' + p + ' ') || t.includes(' ' + p + ','))) return r
  return null
}

/** Região da viagem; viagem nacional sem destino reconhecido conta como Brasil. */
export function regiaoDaViagem(v: { destino?: string | null; titulo?: string | null; tipo?: string | null }): Regiao | null {
  return regiaoDe(v.destino, v.titulo) ?? (v.tipo === 'nacional' ? 'brasil' : null)
}

/** Capa pronta da região da viagem (ou null se não reconhecer). */
export function capaDaRegiao(v: { destino?: string | null; titulo?: string | null; tipo?: string | null }): string | null {
  const r = regiaoDaViagem(v)
  return r ? CAPA_REGIAO[r] : null
}

export { CDN as CDN_REGIOES }
