// Flow — saudação falada da Lia com o nome da pessoa (Supabase Edge Function "voz-lia")
//
// Gera a saudação da Lia com o nome da pessoa (voz natural da ElevenLabs) e devolve o MP3.
// O app escolhe QUAL saudação ("ola" na primeira vez do dia, "volta1"…"volta4" quando a pessoa volta no mesmo dia),
// mas o texto de cada uma é fixo aqui no servidor.
// Cada nome é gerado UMA vez e guardado no cofre privado "vozes" (pasta da própria pessoa); das próximas vezes
// a função só devolve o arquivo guardado, sem gastar créditos.
//
// Segurança:
// - A chave da ElevenLabs fica só nos segredos ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID.
// - O texto NÃO vem do app: o app só escolhe uma das frases fixas abaixo, e o nome vem do perfil da pessoa logada. Ninguém consegue
//   usar a função para gerar outros áudios com a sua conta.
// - Limite de 10 gerações novas por pessoa a cada 24 h (cada frase só é gerada uma vez por nome).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ORIGENS = ['https://flowapp-virid.vercel.app', 'http://localhost:5173']
const LIMITE_DIA = 10

// Frases fixas — {n} vira o primeiro nome. Devem bater com o texto mostrado na tela (SAUDACOES em Viagem.tsx).
const FRASES: Record<string, string> = {
  ola: 'Oi, {n}! Que bom te ver por aqui. Eu sou a Lia, sua concierge. Como posso te ajudar na sua viagem?',
  volta1: 'Oi de novo, {n}! Que bom que você voltou. Em que mais posso te ajudar?',
  volta2: 'Olha você aqui de novo, {n}! Pode falar, estou te ouvindo.',
  volta3: 'Voltou, {n}! Ficou faltando alguma coisa da viagem? Me conta.',
  volta4: 'Oi, {n}! Estou aqui de novo pra você. O que vamos resolver agora?',
}

function cors(origem: string | null) {
  return {
    'Access-Control-Allow-Origin': origem && ORIGENS.includes(origem) ? origem : ORIGENS[0],
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

// Só letras (com acento), espaço, hífen e apóstrofo; primeiro nome; até 30 caracteres
function limparNome(n: unknown) {
  const p = String(n || '').trim().split(/\s+/)[0] || ''
  return p.replace(/[^\p{L}'-]/gu, '').slice(0, 30)
}

async function resumo(texto: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(b)).slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get('Origin'))
  const erro = (msg: string, status: number) =>
    new Response(JSON.stringify({ erro: msg }), { status, headers: { ...h, 'Content-Type': 'application/json' } })
  const audio = (dados: ArrayBuffer | Blob) =>
    new Response(dados, { headers: { ...h, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=31536000' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  if (req.method !== 'POST') return erro('Método não permitido.', 405)

  const chave = Deno.env.get('ELEVENLABS_API_KEY')
  const voz = Deno.env.get('ELEVENLABS_VOICE_ID')
  if (!chave || !voz) return erro('A voz ainda não foi configurada.', 500)
  const auth = req.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return erro('Entre na sua conta.', 401)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  })
  const { data: quem } = await db.auth.getUser(auth.slice(7))
  if (!quem?.user) return erro('Sessão expirada.', 401)
  const eu = quem.user.id

  const { data: perfil } = await db.from('perfis').select('nome').eq('id', eu).maybeSingle()
  const nome = limparNome(perfil?.nome)
  if (!nome) return erro('Sem nome no perfil.', 400)

  let tipo = 'ola'
  try { const b = await req.json(); if (typeof b?.tipo === 'string' && b.tipo in FRASES) tipo = b.tipo } catch { /* sem corpo: ola */ }
  const frase = FRASES[tipo].replace('{n}', nome)
  const caminho = `${eu}/ola-${await resumo(voz + frase)}.mp3`

  // Já gerado antes? Devolve o guardado.
  const guardado = await db.storage.from('vozes').download(caminho)
  if (guardado.data) return audio(guardado.data)

  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await db.from('uso_ia').select('id', { count: 'exact', head: true }).eq('tipo', 'voz').gte('criado_em', desde)
  if ((count ?? 0) >= LIMITE_DIA) return erro('Limite de vozes do dia atingido.', 429)
  await db.from('uso_ia').insert({ tipo: 'voz' })

  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voz)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': chave, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: frase,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
    }),
  })
  if (!r.ok) {
    console.error('elevenlabs', r.status, (await r.text()).slice(0, 300))
    return erro('Não foi possível gerar a voz agora.', 502)
  }
  const mp3 = await r.arrayBuffer()
  await db.storage.from('vozes').upload(caminho, new Blob([mp3], { type: 'audio/mpeg' }), { contentType: 'audio/mpeg', upsert: true })
  return audio(mp3)
})
