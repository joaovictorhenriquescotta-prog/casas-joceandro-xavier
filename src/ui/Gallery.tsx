import { useEffect, useRef, useState } from 'react';
import { GALLERY, galleryUrl } from '../config/gallery';
import { Icon } from './icons';

export function Gallery({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const total = GALLERY.length;
  const go = (step: number) => setIndex((i) => (i + step + total) % total);
  const image = GALLERY[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    thumbs.current?.children[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    // Pré-carrega a próxima imagem para a troca ser imediata.
    new Image().src = galleryUrl(GALLERY[(index + 1) % total].file);
  }, [index, total]);

  return (
    <div className="gallery" role="dialog" aria-modal="true" aria-label="Galeria de imagens">
      <div className="gallery-top">
        <span className="gallery-count">{index + 1} / {total}</span>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar galeria"><Icon.close /></button>
      </div>

      <div
        className="gallery-stage"
        onClick={(e) => e.target === e.currentTarget && onClose()}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        <button className="gallery-nav prev" onClick={() => go(-1)} aria-label="Imagem anterior">‹</button>
        <img key={image.file} src={galleryUrl(image.file)} alt={image.caption} />
        <button className="gallery-nav next" onClick={() => go(1)} aria-label="Próxima imagem">›</button>
      </div>

      <p className="gallery-caption">{image.caption}<span>Imagens ilustrativas</span></p>

      <div className="gallery-thumbs" ref={thumbs}>
        {GALLERY.map((g, i) => (
          <button key={g.file} className={i === index ? 'on' : ''} onClick={() => setIndex(i)} aria-label={g.caption}>
            <img src={galleryUrl(g.file, true)} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
