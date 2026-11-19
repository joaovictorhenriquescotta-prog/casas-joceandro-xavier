// Galeria da tela inicial. Arquivos em public/galeria/ (NN.webp = imagem grande, NN-mini.webp = miniatura).
// Para trocar ou acrescentar imagens: gere os dois arquivos e edite esta lista.
export interface GalleryImage {
  file: string;
  caption: string;
}

export const GALLERY: GalleryImage[] = [
  { file: '01', caption: 'As duas casas na esquina ao entardecer' },
  { file: '02', caption: 'Vista da esquina pela rua' },
  { file: '03', caption: 'Vista frontal do muro e dos portões' },
  { file: '04', caption: 'Vista aérea das duas casas' },
  { file: '16', caption: 'Casa 1: garagem e entrada' },
  { file: '17', caption: 'Casa 1: garagem, jardim e portão' },
  { file: '18', caption: 'Casa 1: fachada com iluminação indireta' },
  { file: '19', caption: 'Casa 2: garagem e entrada' },
  { file: '20', caption: 'Casa 2: fachada e jardim lateral' },
  { file: '21', caption: 'Casa 2: fachada vista da garagem' },
  { file: '05', caption: 'Garagem e fachada vistas de perto' },
  { file: '06', caption: 'Garagem por outro ângulo' },
  { file: '07', caption: 'Garagem e canteiro lateral' },
  { file: '28', caption: 'Casa 1: sala de estar integrada à cozinha' },
  { file: '26', caption: 'Casa 1: cozinha e jantar' },
  { file: '27', caption: 'Casa 1: cozinha vista da sala' },
  { file: '24', caption: 'Casa 1: cozinha' },
  { file: '25', caption: 'Casa 1: quarto' },
  { file: '29', caption: 'Casa 1: suíte' },
  { file: '22', caption: 'Casa 1: banheiro social' },
  { file: '23', caption: 'Casa 1: banho da suíte' },
  { file: '36', caption: 'Casa 2: sala de estar com painel ripado' },
  { file: '35', caption: 'Casa 2: jantar e cozinha' },
  { file: '34', caption: 'Casa 2: bancada da cozinha' },
  { file: '32', caption: 'Casa 2: cozinha' },
  { file: '33', caption: 'Casa 2: quarto' },
  { file: '37', caption: 'Casa 2: suíte' },
  { file: '30', caption: 'Casa 2: banheiro social' },
  { file: '31', caption: 'Casa 2: banho da suíte' },
  { file: '08', caption: 'Planta humanizada das duas casas' },
  { file: '09', caption: 'Planta humanizada em detalhe' },
  { file: '39', caption: 'Planta humanizada vista de cima' },
  { file: '38', caption: 'Planta humanizada em perspectiva' },
  { file: '40', caption: 'Planta humanizada com o lote de esquina' },
  { file: '10', caption: 'Opção de cores: Azul-marinho' },
  { file: '11', caption: 'Opção de cores: Bege e neutros' },
  { file: '12', caption: 'Opção de cores: Cinza e preto' },
  { file: '13', caption: 'Opção de cores: Marrom cacau' },
  { file: '14', caption: 'Opção de cores: Terracota rosada' },
  { file: '15', caption: 'Opção de cores: Verde-oliva' },
];

export const galleryUrl = (file: string, mini = false) => `/galeria/${file}${mini ? '-mini' : ''}.webp`;
