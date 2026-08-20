import type { Coordinates } from "./contracts";
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from "maplibre-gl";

export const EXCHANGE_PIN_LAYER_ID = "exchange-2-5d-pins";

export type ExchangeMapPinKind = "highlight" | "focus";

export interface ExchangeMapPinRenderState {
  recordId: string;
  location: Coordinates;
  kind: ExchangeMapPinKind;
  altitude: number;
  scale: number;
  opacity: number;
}

export interface MercatorCoordinateFactory {
  fromLngLat(lngLat: [number, number], altitude?: number): { x: number; y: number; z: number };
}

type GLContext = WebGLRenderingContext | WebGL2RenderingContext;
type PinHitBox = {
  recordId: string;
  priority: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type PinPalette = {
  light: string;
  mid: string;
  base: string;
  dark: string;
  edge: string;
  specular: string;
};

type ProgramSources = {
  spriteVertex: string;
  spriteFragment: string;
  tetherVertex: string;
  tetherFragment: string;
};

const PIN_BASE_WIDTH = 52;
const PIN_BASE_HEIGHT = 72;
const PIN_TEXTURE_WIDTH = 192;
const PIN_TEXTURE_HEIGHT = 256;
const SPRITE_FLOATS_PER_VERTEX = 8;
const TETHER_FLOATS_PER_VERTEX = 7;

const palettes: Record<ExchangeMapPinKind, PinPalette> = {
  highlight: {
    light: "#d0ad58",
    mid: "#aa7d25",
    base: "#8a6418",
    dark: "#4b340d",
    edge: "#342307",
    specular: "rgba(255,245,214,.68)",
  },
  focus: {
    light: "#f5dc96",
    mid: "#e4b84e",
    base: "#d6a23a",
    dark: "#7b5314",
    edge: "#523408",
    specular: "rgba(255,250,229,.84)",
  },
};

function finiteCoordinate(location: Coordinates) {
  return Number.isFinite(location.lat) && Number.isFinite(location.lng);
}

function isWebGL2(gl: GLContext): gl is WebGL2RenderingContext {
  return typeof (gl as WebGL2RenderingContext).createVertexArray === "function";
}

function shaderSources(gl: GLContext): ProgramSources {
  if (isWebGL2(gl)) {
    return {
      spriteVertex: `#version 300 es
        precision highp float;
        in vec3 a_anchor;
        in vec2 a_offset;
        in vec2 a_uv;
        in float a_opacity;
        uniform mat4 u_matrix;
        uniform vec2 u_viewport;
        out vec2 v_uv;
        out float v_opacity;
        void main() {
          vec4 clip = u_matrix * vec4(a_anchor, 1.0);
          vec2 offsetNdc = vec2((a_offset.x * 2.0) / u_viewport.x, (a_offset.y * 2.0) / u_viewport.y);
          clip.xy += offsetNdc * clip.w;
          gl_Position = clip;
          v_uv = a_uv;
          v_opacity = a_opacity;
        }
      `,
      spriteFragment: `#version 300 es
        precision mediump float;
        in vec2 v_uv;
        in float v_opacity;
        uniform sampler2D u_texture;
        out vec4 outColor;
        void main() {
          vec4 color = texture(u_texture, v_uv);
          color.a *= v_opacity;
          if (color.a < 0.01) discard;
          color.rgb *= color.a;
          outColor = color;
        }
      `,
      tetherVertex: `#version 300 es
        precision highp float;
        in vec3 a_position;
        in vec4 a_color;
        uniform mat4 u_matrix;
        out vec4 v_color;
        void main() {
          gl_Position = u_matrix * vec4(a_position, 1.0);
          v_color = a_color;
        }
      `,
      tetherFragment: `#version 300 es
        precision mediump float;
        in vec4 v_color;
        out vec4 outColor;
        void main() { outColor = vec4(v_color.rgb * v_color.a, v_color.a); }
      `,
    };
  }

  return {
    spriteVertex: `
      precision highp float;
      attribute vec3 a_anchor;
      attribute vec2 a_offset;
      attribute vec2 a_uv;
      attribute float a_opacity;
      uniform mat4 u_matrix;
      uniform vec2 u_viewport;
      varying vec2 v_uv;
      varying float v_opacity;
      void main() {
        vec4 clip = u_matrix * vec4(a_anchor, 1.0);
        vec2 offsetNdc = vec2((a_offset.x * 2.0) / u_viewport.x, (a_offset.y * 2.0) / u_viewport.y);
        clip.xy += offsetNdc * clip.w;
        gl_Position = clip;
        v_uv = a_uv;
        v_opacity = a_opacity;
      }
    `,
    spriteFragment: `
      precision mediump float;
      varying vec2 v_uv;
      varying float v_opacity;
      uniform sampler2D u_texture;
      void main() {
        vec4 color = texture2D(u_texture, v_uv);
        color.a *= v_opacity;
        if (color.a < 0.01) discard;
        color.rgb *= color.a;
        gl_FragColor = color;
      }
    `,
    tetherVertex: `
      precision highp float;
      attribute vec3 a_position;
      attribute vec4 a_color;
      uniform mat4 u_matrix;
      varying vec4 v_color;
      void main() {
        gl_Position = u_matrix * vec4(a_position, 1.0);
        v_color = a_color;
      }
    `,
    tetherFragment: `
      precision mediump float;
      varying vec4 v_color;
      void main() { gl_FragColor = vec4(v_color.rgb * v_color.a, v_color.a); }
    `,
  };
}

function createShader(gl: GLContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create 2.5D marker shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown shader compilation error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: GLContext, vertexSource: string, fragmentSource: string) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to create 2.5D marker program.");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unknown marker program link error.";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function pinPath(dx = 0, dy = 0) {
  const path = new Path2D();
  path.moveTo(96 + dx, 236 + dy);
  path.bezierCurveTo(80 + dx, 210 + dy, 34 + dx, 158 + dy, 26 + dx, 106 + dy);
  path.bezierCurveTo(18 + dx, 50 + dy, 49 + dx, 18 + dy, 94 + dx, 16 + dy);
  path.bezierCurveTo(140 + dx, 14 + dy, 171 + dx, 49 + dy, 166 + dx, 103 + dy);
  path.bezierCurveTo(161 + dx, 153 + dy, 113 + dx, 210 + dy, 96 + dx, 236 + dy);
  path.closePath();
  path.ellipse(96 + dx, 84 + dy, 32, 30, 0, 0, Math.PI * 2);
  return path;
}

function createPinCanvas(kind: ExchangeMapPinKind) {
  const palette = palettes[kind];
  const canvas = document.createElement("canvas");
  canvas.width = PIN_TEXTURE_WIDTH;
  canvas.height = PIN_TEXTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create 2.5D pin texture canvas.");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const side = pinPath(8, 7);
  const sideGradient = ctx.createLinearGradient(42, 28, 162, 220);
  sideGradient.addColorStop(0, palette.dark);
  sideGradient.addColorStop(0.55, palette.edge);
  sideGradient.addColorStop(1, "#1f1607");
  ctx.fillStyle = sideGradient;
  ctx.fill(side, "evenodd");

  const front = pinPath();
  const bodyGradient = ctx.createLinearGradient(36, 20, 154, 224);
  bodyGradient.addColorStop(0, palette.light);
  bodyGradient.addColorStop(0.24, palette.mid);
  bodyGradient.addColorStop(0.58, palette.base);
  bodyGradient.addColorStop(1, palette.dark);
  ctx.fillStyle = bodyGradient;
  ctx.fill(front, "evenodd");

  ctx.save();
  ctx.clip(front, "evenodd");
  const faceLight = ctx.createRadialGradient(64, 42, 4, 70, 56, 102);
  faceLight.addColorStop(0, "rgba(255,255,255,.72)");
  faceLight.addColorStop(0.24, "rgba(255,255,255,.24)");
  faceLight.addColorStop(0.62, "rgba(255,255,255,0)");
  ctx.fillStyle = faceLight;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  const innerGradient = ctx.createLinearGradient(67, 56, 125, 112);
  innerGradient.addColorStop(0, palette.edge);
  innerGradient.addColorStop(0.56, palette.dark);
  innerGradient.addColorStop(1, palette.mid);
  ctx.strokeStyle = innerGradient;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.ellipse(96, 84, 35, 33, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.ellipse(96, 84, 25, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  ctx.strokeStyle = palette.specular;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(93, 79, 54, 3.62, 5.02);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,.24)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(92, 80, 29, 27, 0, 3.7, 5.15);
  ctx.stroke();

  return canvas;
}

function createTexture(gl: GLContext, kind: ExchangeMapPinKind) {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Unable to create 2.5D marker texture.");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, createPinCanvas(kind));
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function projectMercator(
  matrix: Float32Array,
  coordinate: { x: number; y: number; z: number },
  width: number,
  height: number,
) {
  const { x, y, z } = coordinate;
  const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
  const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
  const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  if (!Number.isFinite(clipW) || clipW <= 0.000001) return undefined;
  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;
  return {
    x: (ndcX * 0.5 + 0.5) * width,
    y: (1 - (ndcY * 0.5 + 0.5)) * height,
  };
}

export class ExchangePinLayer implements CustomLayerInterface {
  readonly id = EXCHANGE_PIN_LAYER_ID;
  readonly type = "custom" as const;
  readonly renderingMode = "2d" as const;

  private map?: MapLibreMap;
  private visible = true;
  private pins: ExchangeMapPinRenderState[] = [];
  private hitBoxes: PinHitBox[] = [];
  private spriteProgram?: WebGLProgram;
  private tetherProgram?: WebGLProgram;
  private spriteBuffer?: WebGLBuffer;
  private tetherBuffer?: WebGLBuffer;
  private focusTexture?: WebGLTexture;
  private highlightTexture?: WebGLTexture;

  constructor(private readonly mercatorCoordinate: MercatorCoordinateFactory) {}

  setPins(pins: ExchangeMapPinRenderState[]) {
    this.pins = pins.filter((pin) => finiteCoordinate(pin.location) && pin.opacity > 0.001 && pin.scale > 0.001);
    this.map?.triggerRepaint();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    if (!visible) this.hitBoxes = [];
    this.map?.triggerRepaint();
  }

  hitTest(x: number, y: number) {
    return this.hitBoxes
      .filter((box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom)
      .sort((a, b) => b.priority - a.priority)[0]?.recordId;
  }

  onAdd(map: MapLibreMap, gl: GLContext) {
    this.map = map;
    const sources = shaderSources(gl);
    this.spriteProgram = createProgram(gl, sources.spriteVertex, sources.spriteFragment);
    this.tetherProgram = createProgram(gl, sources.tetherVertex, sources.tetherFragment);
    this.spriteBuffer = gl.createBuffer() || undefined;
    this.tetherBuffer = gl.createBuffer() || undefined;
    this.highlightTexture = createTexture(gl, "highlight");
    this.focusTexture = createTexture(gl, "focus");
  }

  onRemove(_map: MapLibreMap, gl: GLContext) {
    if (this.spriteBuffer) gl.deleteBuffer(this.spriteBuffer);
    if (this.tetherBuffer) gl.deleteBuffer(this.tetherBuffer);
    if (this.spriteProgram) gl.deleteProgram(this.spriteProgram);
    if (this.tetherProgram) gl.deleteProgram(this.tetherProgram);
    if (this.focusTexture) gl.deleteTexture(this.focusTexture);
    if (this.highlightTexture) gl.deleteTexture(this.highlightTexture);
    this.spriteBuffer = undefined;
    this.tetherBuffer = undefined;
    this.spriteProgram = undefined;
    this.tetherProgram = undefined;
    this.focusTexture = undefined;
    this.highlightTexture = undefined;
    this.hitBoxes = [];
  }

  private drawTethers(gl: GLContext, matrix: Float32Array) {
    if (!this.tetherProgram || !this.tetherBuffer) return;
    const vertices: number[] = [];
    for (const pin of this.pins) {
      if (pin.altitude <= 0.5) continue;
      const ground = this.mercatorCoordinate.fromLngLat([pin.location.lng, pin.location.lat], 0);
      const lifted = this.mercatorCoordinate.fromLngLat([pin.location.lng, pin.location.lat], pin.altitude);
      const color = pin.kind === "focus"
        ? [0.839, 0.635, 0.227, 0.52 * pin.opacity]
        : [0.541, 0.392, 0.094, 0.30 * pin.opacity];
      vertices.push(ground.x, ground.y, ground.z, ...color, lifted.x, lifted.y, lifted.z, ...color);
    }
    if (!vertices.length) return;

    gl.useProgram(this.tetherProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tetherBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.tetherProgram, "u_matrix"), false, matrix);
    const stride = TETHER_FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;
    const positionLocation = gl.getAttribLocation(this.tetherProgram, "a_position");
    const colorLocation = gl.getAttribLocation(this.tetherProgram, "a_color");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.lineWidth(1);
    gl.drawArrays(gl.LINES, 0, vertices.length / TETHER_FLOATS_PER_VERTEX);
    gl.disableVertexAttribArray(positionLocation);
    gl.disableVertexAttribArray(colorLocation);
  }

  private drawSprites(
    gl: GLContext,
    matrix: Float32Array,
    kind: ExchangeMapPinKind,
    viewportWidth: number,
    viewportHeight: number,
  ) {
    if (!this.spriteProgram || !this.spriteBuffer) return;
    const texture = kind === "focus" ? this.focusTexture : this.highlightTexture;
    if (!texture) return;
    const vertices: number[] = [];

    const addVertex = (
      anchor: { x: number; y: number; z: number },
      offsetX: number,
      offsetY: number,
      u: number,
      v: number,
      opacity: number,
    ) => vertices.push(anchor.x, anchor.y, anchor.z, offsetX, offsetY, u, v, opacity);

    for (const pin of this.pins) {
      if (pin.kind !== kind) continue;
      const anchor = this.mercatorCoordinate.fromLngLat([pin.location.lng, pin.location.lat], pin.altitude);
      const width = PIN_BASE_WIDTH * pin.scale;
      const height = PIN_BASE_HEIGHT * pin.scale;
      const left = -width / 2;
      const right = width / 2;
      const bottom = 0;
      const top = height;
      addVertex(anchor, left, bottom, 0, 0, pin.opacity);
      addVertex(anchor, right, bottom, 1, 0, pin.opacity);
      addVertex(anchor, right, top, 1, 1, pin.opacity);
      addVertex(anchor, left, bottom, 0, 0, pin.opacity);
      addVertex(anchor, right, top, 1, 1, pin.opacity);
      addVertex(anchor, left, top, 0, 1, pin.opacity);
    }

    if (!vertices.length) return;
    gl.useProgram(this.spriteProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.spriteProgram, "u_matrix"), false, matrix);
    gl.uniform2f(gl.getUniformLocation(this.spriteProgram, "u_viewport"), viewportWidth, viewportHeight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(this.spriteProgram, "u_texture"), 0);

    const stride = SPRITE_FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;
    const anchorLocation = gl.getAttribLocation(this.spriteProgram, "a_anchor");
    const offsetLocation = gl.getAttribLocation(this.spriteProgram, "a_offset");
    const uvLocation = gl.getAttribLocation(this.spriteProgram, "a_uv");
    const opacityLocation = gl.getAttribLocation(this.spriteProgram, "a_opacity");
    gl.enableVertexAttribArray(anchorLocation);
    gl.vertexAttribPointer(anchorLocation, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(offsetLocation);
    gl.vertexAttribPointer(offsetLocation, 2, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, stride, 5 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(opacityLocation);
    gl.vertexAttribPointer(opacityLocation, 1, gl.FLOAT, false, stride, 7 * Float32Array.BYTES_PER_ELEMENT);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / SPRITE_FLOATS_PER_VERTEX);
    gl.disableVertexAttribArray(anchorLocation);
    gl.disableVertexAttribArray(offsetLocation);
    gl.disableVertexAttribArray(uvLocation);
    gl.disableVertexAttribArray(opacityLocation);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  render(gl: GLContext, args: CustomRenderMethodInput) {
    if (!this.visible || !this.pins.length || !this.map || !this.spriteProgram || !this.tetherProgram) {
      this.hitBoxes = [];
      return;
    }

    const canvas = this.map.getCanvas();
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    const matrix = new Float32Array(args.defaultProjectionData.mainMatrix as ArrayLike<number>);

    const depthWasEnabled = gl.isEnabled(gl.DEPTH_TEST);
    const cullWasEnabled = gl.isEnabled(gl.CULL_FACE);
    const blendWasEnabled = gl.isEnabled(gl.BLEND);
    const depthWriteWasEnabled = Boolean(gl.getParameter(gl.DEPTH_WRITEMASK));

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    this.drawTethers(gl, matrix);
    this.drawSprites(gl, matrix, "highlight", width, height);
    this.drawSprites(gl, matrix, "focus", width, height);

    gl.depthMask(depthWriteWasEnabled);
    if (depthWasEnabled) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
    if (cullWasEnabled) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
    if (blendWasEnabled) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);

    this.hitBoxes = this.pins.flatMap((pin) => {
      const anchor = this.mercatorCoordinate.fromLngLat([pin.location.lng, pin.location.lat], pin.altitude);
      const point = projectMercator(matrix, anchor, width, height);
      if (!point) return [];
      const pinWidth = PIN_BASE_WIDTH * pin.scale;
      const pinHeight = PIN_BASE_HEIGHT * pin.scale;
      return [{
        recordId: pin.recordId,
        priority: pin.kind === "focus" ? 2 : 1,
        left: point.x - pinWidth / 2,
        right: point.x + pinWidth / 2,
        top: point.y - pinHeight,
        bottom: point.y + 4,
      }];
    });
  }
}
