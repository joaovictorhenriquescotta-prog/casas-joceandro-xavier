// Galeria da tela inicial. Arquivos em public/galeria/ (NN.webp = imagem grande, NN-mini.webp = miniatura).
// Para trocar ou acrescentar imagens: gere os dois arquivos e edite esta lista.
export interface GalleryImage {
  file: string;
  caption: string;
}

export const GALLERY: GalleryImage[] = [
  { file: '01', caption: 'Opção de cores: Azul-marinho' },
  { file: '02', caption: 'Opção de cores: Bege e neutros' },
  { file: '03', caption: 'Opção de cores: Cinza e preto' },
  { file: '04', caption: 'Opção de cores: Marrom cacau' },
  { file: '05', caption: 'Opção de cores: Terracota rosada' },
  { file: '06', caption: 'Opção de cores: Verde-oliva' },
];

export const galleryUrl = (file: string, mini = false) => `/galeria/${file}${mini ? '-mini' : ''}.webp`;
