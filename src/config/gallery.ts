// Galeria da tela inicial. Arquivos em public/galeria/ (NN.webp = imagem grande, NN-mini.webp = miniatura).
// Para trocar ou acrescentar imagens: gere os dois arquivos e edite esta lista.
export interface GalleryImage {
  file: string;
  caption: string;
}

export const GALLERY: GalleryImage[] = [
  { file: '01', caption: 'As duas casas na esquina ao entardecer' },
  { file: '02', caption: 'Fachada e acesso à garagem' },
  { file: '03', caption: 'Fachada com iluminação de fim de tarde' },
  { file: '04', caption: 'Entrada e jardim lateral' },
  { file: '05', caption: 'Garagem e porta de entrada' },
  { file: '06', caption: 'Vista aérea das duas casas' },
  { file: '07', caption: 'Esquina com o muro curvo' },
  { file: '08', caption: 'Quatro opções de cores para a fachada' },
];

export const galleryUrl = (file: string, mini = false) => `/galeria/${file}${mini ? '-mini' : ''}.webp`;
