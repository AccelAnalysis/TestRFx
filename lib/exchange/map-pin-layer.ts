import type { Coordinates } from "./contracts";
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MapLibreMap } from "maplibre-gl";

export const EXCHANGE_PIN_LAYER_ID = "exchange-2-5d-pins";

export type ExchangeMapPinKind = "highlight" | "focus";

export interface ExchangeMapPinRenderState {
  recordId: string;
  location: Coordinates;
  kind: ExchangeMapPinKind;
  scale: number;
  opacity: number;
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

type ShaderSources = {
  vertex: string;
  fragment: string;
};

const PIN_BASE_WIDTH = 52;
const PIN_BASE_HEIGHT = 72;
const PIN_TEXTURE_WIDTH = 192;
const PIN_TEXTURE_HEIGHT = 256;
const PIN_TEXTURE_TIP_Y = 236;
const SPRITE_FLOATS_PER_VERTEX = 5;

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

function shaderSources(gl: GLContext): ShaderSources {
  if (isWebGL2(gl)) {
    return {
      vertex: `#version 300 es
        precision highp float;
        in vec2 a_position;
        in vec2 a_uv;
        in float a_opacity;
        out vec2 v_uv;
        out float v_opacity;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
          v_uv = a_uv;
          v_opacity = a_opacity;
        }
      `,
      fragment: `#version 300 es
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
    };
  }

  return {
    vertex: `
      precision highp float;
      attribute vec2 a_position;
      attribute vec2 a_uv;
      attribute float a_opacity;
      varying vec2 v_uv;
      varying float v_opacity;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_uv = a_uv;
        v_opacity = a_opacity;
      }
    `,
    fragment: `
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
  path.moveTo(96 + dx, PIN_TEXTURE_TIP_Y + dy);
  path.bezierCurveTo(80 + dx, 210 + dy, 34 + dx, 158 + dy, 26 + dx, 106 + dy);
  path.bezierCurveTo(18 + dx, 50 + dy, 49 + dx, 18 + dy, 94 + dx, 16 + dy);
  path.bezierCurveTo(140 + dx, 14 + dy, 171 + dx, 49 + dy, 166 + dx, 103 + dy);
  path.bezierCurveTo(161 + dx, 153 + dy, 113 + dx, 210 + dy, 96 + dx, PIN_TEXTURE_TIP_Y + dy);
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

  // Faux thickness stays horizontal so the front and side silhouettes share
  // one geographic tip. The marker therefore reads as dimensional without a
  // second visual point beneath the record coordinate.
  const side = pinPath(8, 0);
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

function clipX(pixelX: number, viewportWidth: number) {
  return pixelX / viewportWidth * 2 - 1;
}

function clipY(pixelY: number, viewportHeight: number) {
  return 1 - pixelY / viewportHeight * 2;
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
  private spriteBuffer?: WebGLBuffer;
  private focusTexture?: WebGLTexture;
  private highlightTexture?: WebGLTexture;

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
    this.spriteProgram = createProgram(gl, sources.vertex, sources.fragment);
    this.spriteBuffer = gl.createBuffer() || undefined;
    this.highlightTexture = createTexture(gl, "highlight");
    this.focusTexture = createTexture(gl, "focus");
  }

  onRemove(_map: MapLibreMap, gl: GLContext) {
    if (this.spriteBuffer) gl.deleteBuffer(this.spriteBuffer);
    if (this.spriteProgram) gl.deleteProgram(this.spriteProgram);
    if (this.focusTexture) gl.deleteTexture(this.focusTexture);
    if (this.highlightTexture) gl.deleteTexture(this.highlightTexture);

    this.spriteBuffer = undefined;
    this.spriteProgram = undefined;
    this.focusTexture = undefined;
    this.highlightTexture = undefined;
    this.hitBoxes = [];
  }

  private drawSprites(gl: GLContext, kind: ExchangeMapPinKind, viewportWidth: number, viewportHeight: number) {
    if (!this.map || !this.spriteProgram || !this.spriteBuffer) return;
    const texture = kind === "focus" ? this.focusTexture : this.highlightTexture;
    if (!texture) return;

    const vertices: number[] = [];
    const nextHitBoxes: PinHitBox[] = [];

    const addVertex = (x: number, y: number, u: number, v: number, opacity: number) => {
      vertices.push(clipX(x, viewportWidth), clipY(y, viewportHeight), u, v, opacity);
    };

    for (const pin of this.pins) {
      if (pin.kind !== kind) continue;

      // map.project() performs the geographic projection in JavaScript double
      // precision. The GPU only receives normalized screen coordinates near
      // [-1, 1], eliminating Mercator Float32 precision jitter during pan/zoom.
      const point = this.map.project([pin.location.lng, pin.location.lat]);
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;

      const width = PIN_BASE_WIDTH * pin.scale;
      const height = PIN_BASE_HEIGHT * pin.scale;
      const left = point.x - width / 2;
      const right = point.x + width / 2;

      // The procedural texture has transparent pixels below its actual tip.
      // Extend the quad slightly below the geographic point so the painted
      // teardrop tip, not the texture rectangle, lands exactly on the record.
      const tailPadding = (PIN_TEXTURE_HEIGHT - PIN_TEXTURE_TIP_Y) / PIN_TEXTURE_HEIGHT * height;
      const bottom = point.y + tailPadding;
      const top = bottom - height;

      addVertex(left, bottom, 0, 0, pin.opacity);
      addVertex(right, bottom, 1, 0, pin.opacity);
      addVertex(right, top, 1, 1, pin.opacity);
      addVertex(left, bottom, 0, 0, pin.opacity);
      addVertex(right, top, 1, 1, pin.opacity);
      addVertex(left, top, 0, 1, pin.opacity);

      nextHitBoxes.push({
        recordId: pin.recordId,
        priority: pin.kind === "focus" ? 2 : 1,
        left,
        right,
        top,
        bottom: point.y + 4,
      });
    }

    if (vertices.length) {
      gl.useProgram(this.spriteProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(gl.getUniformLocation(this.spriteProgram, "u_texture"), 0);

      const stride = SPRITE_FLOATS_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT;
      const positionLocation = gl.getAttribLocation(this.spriteProgram, "a_position");
      const uvLocation = gl.getAttribLocation(this.spriteProgram, "a_uv");
      const opacityLocation = gl.getAttribLocation(this.spriteProgram, "a_opacity");

      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(uvLocation);
      gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
      gl.enableVertexAttribArray(opacityLocation);
      gl.vertexAttribPointer(opacityLocation, 1, gl.FLOAT, false, stride, 4 * Float32Array.BYTES_PER_ELEMENT);
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / SPRITE_FLOATS_PER_VERTEX);
      gl.disableVertexAttribArray(positionLocation);
      gl.disableVertexAttribArray(uvLocation);
      gl.disableVertexAttribArray(opacityLocation);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    this.hitBoxes.push(...nextHitBoxes);
  }

  render(gl: GLContext, _args: CustomRenderMethodInput) {
    if (!this.visible || !this.pins.length || !this.map || !this.spriteProgram) {
      this.hitBoxes = [];
      return;
    }

    const canvas = this.map.getCanvas();
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);

    const depthWasEnabled = gl.isEnabled(gl.DEPTH_TEST);
    const cullWasEnabled = gl.isEnabled(gl.CULL_FACE);
    const blendWasEnabled = gl.isEnabled(gl.BLEND);
    const depthWriteWasEnabled = Boolean(gl.getParameter(gl.DEPTH_WRITEMASK));

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    this.hitBoxes = [];
    this.drawSprites(gl, "highlight", width, height);
    this.drawSprites(gl, "focus", width, height);

    gl.depthMask(depthWriteWasEnabled);
    if (depthWasEnabled) gl.enable(gl.DEPTH_TEST); else gl.disable(gl.DEPTH_TEST);
    if (cullWasEnabled) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE);
    if (blendWasEnabled) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
  }
}
