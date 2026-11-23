// Keyboard + mouse input. Keys are read per frame by main.js; no listeners elsewhere.
export function createInput() {
  const keys = {};
  const state = { keys, mouseX: 0, mouseY: 0, clicked: false, orbit: 0 };
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
  window.addEventListener('mousemove', (e) => { state.mouseX = e.clientX; state.mouseY = e.clientY; });
  window.addEventListener('mousedown', () => { state.clicked = true; });
  window.addEventListener('mouseup', () => { state.clicked = false; });
  window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; });
  return state;
}

export function inputVector(input) {
  const k = input.keys;
  let f = 0, r = 0;
  if (k.KeyW || k.ArrowUp) f += 1;
  if (k.KeyS || k.ArrowDown) f -= 1;
  if (k.KeyA || k.ArrowLeft) r -= 1;
  if (k.KeyD || k.ArrowRight) r += 1;
  return { forward: f, right: r, run: !!k.ShiftLeft || !!k.ShiftRight };
}
