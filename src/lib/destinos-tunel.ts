import type { FotoTunel } from '../components/ui/perspective-tunnel-hero'

/** Fotos dos destinos mais visitados (geradas no Higgsfield, 640 × 800, ~110 KB cada) para o túnel da abertura. */
const CDN = 'https://d2ol7oe51mr4n9.cloudfront.net/user_3Hrjdnb6LBzJK6SYxcNE6VQdZEf/'

export const DESTINOS_TUNEL: FotoTunel[] = [
  { src: CDN + 'a82b31d1-2cdd-4591-8e89-577816204a20.jpg', titulo: 'França' },
  { src: CDN + '1aee6ccb-7abb-4dde-a006-859b16cb4718.jpg', titulo: 'Itália' },
  { src: CDN + 'e0e45512-f078-404e-8080-b498efb66bbb.jpg', titulo: 'Espanha' },
  { src: CDN + 'd02608b9-410d-441d-991b-d768182b80ec.jpg', titulo: 'Estados Unidos' },
  { src: CDN + '680c51a9-bfe0-4681-ab6a-ffcb304bfff3.jpg', titulo: 'Reino Unido' },
  { src: CDN + '18ab1dec-f3ec-44d8-84a7-1ded0e9b764e.jpg', titulo: 'Grécia' },
  { src: CDN + '6f121420-3610-4c92-bffd-30ca4188b9f1.jpg', titulo: 'Japão' },
  { src: CDN + 'efe48076-ef26-4803-9ae3-90f176cd1931.jpg', titulo: 'Portugal' },
  { src: CDN + 'ba2883d4-4049-4478-9f78-dfc8c07e0488.jpg', titulo: 'Turquia' },
  { src: CDN + '64366701-f293-4077-852c-091bae4fc26a.jpg', titulo: 'Emirados' },
]
