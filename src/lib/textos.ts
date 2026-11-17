export const TIPOS: [string, string][] = [
  ['voo', 'Voo'], ['hotel', 'Hospedagem'], ['trem', 'Trem'], ['onibus', 'Ônibus'], ['transfer', 'Transfer'],
  ['carro', 'Carro'], ['passeio', 'Passeio'], ['restaurante', 'Restaurante'], ['outro', 'Outro'],
]
export const tipoNome = (t?: string | null) => (TIPOS.find((x) => x[0] === t) || [t, 'Reserva'])[1]
export const MOEDAS = ['BRL', 'EUR', 'USD', 'GBP', 'ARS', 'CLP', 'MXN', 'JPY']

const ERROS: [RegExp, string | null][] = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar. Procure a mensagem do Flow na sua caixa de entrada.'],
  [/user already registered/i, 'Já existe uma conta com este e-mail.'],
  [/password/i, 'Senha fraca: use pelo menos 10 caracteres, com maiúscula, minúscula, número e símbolo.'],
  [/rate limit|too many/i, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'],
  [/compromisso confirmado/i, 'Este compromisso está confirmado (cadeado). Destrave antes de mudar o dia ou a hora.'],
  [/duplicate key|reservas_sem_duplicar/i, 'Já existe uma reserva com este código nesta viagem.'],
  [/row-level security|permission denied|not allowed/i, 'Você não tem permissão para fazer isso.'],
  [/failed to fetch|networkerror|load failed/i, 'Sem conexão. Verifique a internet e tente de novo.'],
  [/sessão/i, null],
]
export function erroPt(e: unknown) {
  const m = (e as any)?.message || String(e)
  for (const [re, txt] of ERROS) if (re.test(m)) return txt || m
  return 'Algo deu errado. ' + m
}

export const senhaForte = (s: string) => s.length >= 10 && /[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s)

/** Lê um campo de formulário: texto aparado ou null. */
export const campo = (fd: FormData, k: string) => {
  const v = (fd.get(k) ?? '').toString().trim()
  return v === '' ? null : v
}
