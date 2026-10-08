// One shared cube mesh; the vertex shader places it in a fixed, angled camera.
export function createScene(canvas) {
  const gl = canvas.getContext?.('webgl', { antialias: true });
  if (!gl) return null;
  function shader(type, source) {
    const value = gl.createShader(type);
    gl.shaderSource(value, source);
    gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value));
    return value;
  }
  const program = gl.createProgram();
  const vertex = shader(gl.VERTEX_SHADER, `
    attribute vec3 position;
    attribute vec3 normal;
    uniform vec3 offset;
    uniform vec3 size;
    uniform float tilt;
    uniform float aspect;
    uniform float viewHeight;
    varying float light;
    void main() {
      float c = cos(tilt), s = sin(tilt);
      vec3 p = position * size;
      p.xy = mat2(c, s, -s, c) * p.xy;
      p += offset;
      // Orthographic projection: camera looks down toward the floor.
      float y = (p.y - 1.0) * 0.92 - p.z * 0.39;
      float depth = (p.y - 1.0) * 0.39 + p.z * 0.92;
      gl_Position = vec4(p.x / (viewHeight * aspect), y / viewHeight, -depth / 20.0, 1.0);
      vec3 n = normal;
      n.xy = mat2(c, s, -s, c) * n.xy;
      light = 0.4 + 0.6 * max(0.0, dot(n, normalize(vec3(-0.4, 1.0, 0.7))));
    }
  `);
  const fragment = shader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform vec3 color;
    varying float light;
    void main() { gl_FragColor = vec4(color * light, 1.0); }
  `);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  gl.useProgram(program);
  const vertices = [];
  const faces = [
    [[1,0,0], [[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]]],
    [[-1,0,0], [[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]]],
    [[0,1,0], [[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]]],
    [[0,-1,0], [[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]]],
    [[0,0,1], [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],
    [[0,0,-1], [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],
  ];
  for (const [normal, corners] of faces) {
    for (const i of [0,1,2,0,2,3]) vertices.push(...corners[i].map(v => v / 2), ...normal);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  for (const [name, offset] of [['position', 0], ['normal', 12]]) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 24, offset);
  }
  const uniforms = Object.fromEntries(['offset','size','tilt','aspect','viewHeight','color'].map(name => [name, gl.getUniformLocation(program, name)]));
  gl.enable(gl.DEPTH_TEST);
  let pose = { x: 0, y: 0, rotation: 0 };
  let enemy = 'Sentinel';
  const flashes = { player: null, enemy: null };
  function box(offset, size, color, tilt = 0) {
    gl.uniform3fv(uniforms.offset, offset);
    gl.uniform3fv(uniforms.size, size);
    gl.uniform3fv(uniforms.color, color);
    gl.uniform1f(uniforms.tilt, tilt);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
  function fighter(x, color, scale, tilt = 0, lift = 0) {
    const part = (y, size, z = 0, dx = 0) => box([x + dx, y * scale + lift, z], size.map(v => v * scale), color, tilt);
    part(1.2, [.65,.85,.4]);
    part(1.9, [.42,.42,.42]);
    part(.4, [.22,.8,.28], 0, -.2 * scale);
    part(.4, [.22,.8,.28], 0, .2 * scale);
    part(1.1, [.18,.7,.22], 0, -.48 * scale);
    part(1.1, [.18,.7,.22], 0, .48 * scale);
    // A blade on the side facing the opponent.
    box([x + (x < 0 ? .65 : -.65) * scale, 1.3 * scale + lift, .2], [.09,1.3 * scale,.12], [.75,.8,.84], tilt);
  }
  function draw() {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(.065,.083,.1,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const aspect = canvas.width / canvas.height;
    gl.uniform1f(uniforms.aspect, aspect);
    gl.uniform1f(uniforms.viewHeight, Math.max(2.5, 3 / aspect));
    box([0,-.1,0], [20,.2,14], [.16,.2,.22]);
    for (const x of [-1.5,1.5]) box([x,.015,0], [1.4,.025,1.1], [.23,.28,.29]);
    fighter(-1.5, flashes.player || [.43,.72,.78], 1);
    const color = enemy === 'Duelist' ? [.78,.47,.38] : [.82,.65,.4];
    fighter(1.5 + pose.x / 100, flashes.enemy || color, enemy === 'Warden' ? 1.2 : 1, -pose.rotation * Math.PI / 180, -pose.y / 100);
  }
  new ResizeObserver(draw).observe(canvas);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    canvas.closest('.arena').classList.remove('has-webgl');
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  return {
    render(name, nextPose = { x: 0, y: 0, rotation: 0 }) { enemy = name; pose = nextPose; draw(); },
    flash(target, hex) {
      const color = hex.match(/\w\w/g).map(v => parseInt(v, 16) / 255);
      flashes[target] = color;
      draw();
      setTimeout(() => { if (flashes[target] === color) { flashes[target] = null; draw(); } }, 250);
    },
  };
}
