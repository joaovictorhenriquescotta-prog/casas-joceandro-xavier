// Opções de cores da fachada mostradas na tela inicial (botão "Cores da fachada").
// Cada opção troca a imagem de fundo por um render com o mesmo enquadramento (renders/FINAIS).
// Para acrescentar: gere public/cores/<id>.jpg com 2560 px de largura e inclua aqui.
// "color" é a cor do volume principal da fachada, medida no próprio render.
export interface FacadeColor {
  id: string;
  name: string;
  color: string;
  image: string;
}

export const FACADE_COLORS: FacadeColor[] = [
  { id: 'original', name: 'Laranja (original)', color: '#e1893f', image: '/hero.jpg' },
  { id: 'azul-marinho', name: 'Azul-marinho', color: '#394756', image: '/cores/azul-marinho.jpg' },
  { id: 'bege-e-neutros', name: 'Bege e neutros', color: '#caa47e', image: '/cores/bege-e-neutros.jpg' },
  { id: 'cinza-e-preto', name: 'Cinza e preto', color: '#585757', image: '/cores/cinza-e-preto.jpg' },
  { id: 'marrom-cacau', name: 'Marrom cacau', color: '#5f382a', image: '/cores/marrom-cacau.jpg' },
  { id: 'terracota-rosada', name: 'Terracota rosada', color: '#bc7663', image: '/cores/terracota-rosada.jpg' },
  { id: 'verde-oliva', name: 'Verde-oliva', color: '#67673b', image: '/cores/verde-oliva.jpg' },
];
