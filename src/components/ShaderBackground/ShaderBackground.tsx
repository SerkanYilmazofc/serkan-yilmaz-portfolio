import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../hooks/useMediaQuery";
import "./ShaderBackground.css";

export function ShaderBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reduced) return;

    const gl =
      canvas.getContext("webgl", { alpha: false, antialias: false }) ||
      canvas.getContext("experimental-webgl");
    if (!gl || !(gl instanceof WebGLRenderingContext)) return;

    const syncSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor((canvas.clientWidth || 1280) * dpr);
      const h = Math.floor((canvas.clientHeight || 720) * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);
    syncSize();

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      varying vec2 v_texCoord;

      void main() {
        vec2 uv = v_texCoord;
        vec2 mouse = u_mouse / u_resolution;

        float noise = sin(uv.x * 3.0 + u_time * 0.5) * cos(uv.y * 2.0 - u_time * 0.3);
        noise += sin(uv.y * 5.0 + u_time * 0.8) * cos(uv.x * 4.0 - u_time * 0.4);

        float dist = distance(uv, mouse);
        float glow = smoothstep(0.4, 0.0, dist) * 0.3;

        vec3 color1 = vec3(0.02, 0.02, 0.05);
        vec3 color2 = vec3(0.1, 0.2, 0.5);
        vec3 color3 = vec3(0.3, 0.1, 0.5);

        vec3 finalColor = mix(color1, color2, noise * 0.5 + 0.5);
        finalColor = mix(finalColor, color3, glow);

        float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
        finalColor += grain * 0.02;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram();
    if (!prog) return;
    const vsh = compile(gl.VERTEX_SHADER, vs);
    const fsh = compile(gl.FRAGMENT_SHADER, fs);
    if (!vsh || !fsh) return;
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const pos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, "u_time");
    const uRes = gl.getUniformLocation(prog, "u_resolution");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    let raf = 0;
    let running = true;

    const onMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = 1.0 - (event.clientY - rect.top) / rect.height;
      mouse.x = nx * canvas.width;
      mouse.y = ny * canvas.height;
    };

    const onVisibility = () => {
      running = document.visibilityState === "visible";
      if (running) raf = requestAnimationFrame(render);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    const render = (t: number) => {
      if (!running) return;
      syncSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
    };
  }, [reduced]);

  return (
    <div className="shader-bg" aria-hidden="true">
      {reduced ? (
        <div className="shader-bg__fallback" />
      ) : (
        <canvas ref={canvasRef} className="shader-bg__canvas" />
      )}
    </div>
  );
}
