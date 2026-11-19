// Opções de cores da fachada mostradas na tela inicial (botão "Cores da fachada").
// Cada opção troca a imagem de fundo por um render com o mesmo enquadramento
// (renders isométricos de "renders/AQUI REALMENTE ESTAO AS FINAIS/FACHADA").
// Para acrescentar: gere public/cores/<id>.jpg com 2560 px de largura e inclua aqui.
// "color" é a cor do volume principal da fachada, medida no próprio render.
export interface FacadeColor {
  id: string;
  name: string;
  color: string;
  image: string;
}

export const FACADE_COLORS: FacadeColor[] = [
  { id: 'original', name: 'Laranja (original)', color: '#d98a45', image: '/hero.jpg' },
  { id: 'azul-marinho', name: 'Azul-marinho', color: '#3b4c5a', image: '/cores/azul-marinho.jpg' },
  { id: 'bege-e-neutros', name: 'Bege e neutros', color: '#c3aa8d', image: '/cores/bege-e-neutros.jpg' },
  { id: 'cinza-e-preto', name: 'Branco, cinza e preto', color: '#6d6b6a', image: '/cores/cinza-e-preto.jpg' },
  { id: 'terracota-rosada', name: 'Terracota rosada', color: '#ab6c5d', image: '/cores/terracota-rosada.jpg' },
  { id: 'verde-oliva', name: 'Verde-oliva', color: '#656234', image: '/cores/verde-oliva.jpg' },
];
