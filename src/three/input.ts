/** Estado de entrada (teclado e joystick virtual), lido a cada quadro. */
export const input = {
  keys: new Set<string>(),
  joy: { x: 0, y: 0 },
};

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    input.keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => input.keys.clear());
}
