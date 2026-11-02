/** Минимальная обвязка над WebGL: полноэкранный фрагментный шейдер. */

const VERTEX_SOURCE = `
  attribute vec2 p;
  void main() { gl_Position = vec4(p, 0., 1.); }
`;

export interface FullscreenPass {
  gl: WebGLRenderingContext;
  /** Адрес uniform-переменной шейдера по имени. */
  uniform(name: string): WebGLUniformLocation | null;
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(shader));
  return shader;
}

/**
 * Создаёт WebGL-контекст на канвасе и рисует на нём один фрагментный шейдер на весь экран.
 * Возвращает null, если WebGL недоступен или шейдер не собрался — тогда остаётся CSS-фон.
 */
export function createFullscreenPass(
  canvas: HTMLCanvasElement,
  fragmentSource: string,
  attributes: WebGLContextAttributes,
): FullscreenPass | null {
  const gl = canvas.getContext('webgl', attributes);
  if (!gl) return null;

  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn(gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  // Один большой треугольник, перекрывающий весь экран.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  return { gl, uniform: (name) => gl.getUniformLocation(program, name) };
}

export function drawFullscreen(gl: WebGLRenderingContext): void {
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
