// Keyboard and mouse input. WASD/arrows to move and drive, E to enter cars,
// J for jobs, 1-3 weapons, R radio, M map zoom, P/Esc pause, F save.
export function createInput() {
  const keys = {};
  const input = {
    up: false, down: false, left: false, right: false, shift: false,
    mouseX: 640, mouseY: 360, mouseDown: false, mouseClicked: false,
    pressed: {},
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'shift', ShiftRight: 'shift',
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed[e.code] = true;
    keys[e.code] = true;
    sync();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    sync();
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    sync();
  });

  function sync() {
    input.up = !!(keys.KeyW || keys.ArrowUp);
    input.down = !!(keys.KeyS || keys.ArrowDown);
    input.left = !!(keys.KeyA || keys.ArrowLeft);
    input.right = !!(keys.KeyD || keys.ArrowRight);
    input.shift = !!(keys.ShiftLeft || keys.ShiftRight);
  }

  return {
    state: input,
    attachCanvas(canvas) {
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
        input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
      });
      canvas.addEventListener('mousedown', (e) => {
        input.mouseDown = true;
        input.mouseClicked = true;
        const r = canvas.getBoundingClientRect();
        input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
        input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
      });
      window.addEventListener('mouseup', () => {
        input.mouseDown = false;
      });
    },
    endFrame() {
      input.pressed = {};
      input.mouseClicked = false;
    },
  };
}
