// Keyboard + mouse input for Azura Bay (desktop Chrome, WASD + mouse).
// Pure state — main.js reads it each frame; nothing here touches the DOM.
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.clicked = false;
    this.attached = false;
  }

  attach() {
    if (this.attached || typeof window === 'undefined') return;
    this.attached = true;
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener('mousedown', () => { this.clicked = true; });
    window.addEventListener('mouseup', () => { this.clicked = false; });
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(code) {
    return this.keys.has(code);
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }

  consume(code) {
    if (this.keys.has(code)) {
      this.keys.delete(code);
      return true;
    }
    return false;
  }
}
