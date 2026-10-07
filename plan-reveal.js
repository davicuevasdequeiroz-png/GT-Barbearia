/* Organic reveal: only the mask moves; both surface textures keep the same UVs.
 * Optional per-card images: data-reveal-base="..." / data-reveal-alternate="...".
 * Use same-origin images (or images served with CORS permission).
 */
const PLAN_REVEAL_SETTINGS = Object.freeze({
  radius: 112,            // CSS pixels, independent of screen aspect ratio / DPR
  followDelay: 0.12,      // seconds
  trailDuration: 1.15,    // seconds for a full-strength trail to retract
  dissipation: 1.0,       // multiplier on temporal decay
  velocityStretch: 0.85,
  irregularity: 0.42,
  edgeSoftness: 0.012,
  flowStrength: 18,       // residual curl motion, CSS pixels per second
  contourStrength: 0.55, // fine contour lines on the default surface
  maskResolution: 0.85,
  maxPixelRatio: 1.5
});

function createPlanReveal(card, overrides = {}) {
  const settings = { ...PLAN_REVEAL_SETTINGS, ...overrides };
  const canvas = document.createElement('canvas');
  canvas.className = 'plan-reveal';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) return () => {};

  const resources = [];
  const listeners = new AbortController();
  let disposed = false, frame = 0, lastFrame = 0, lastMove = -Infinity;
  let lastDeposit = -Infinity, inside = false, visible = true, hasPoint = false;
  let width = 1, height = 1, maskWidth = 1, maskHeight = 1, readIndex = 0;
  let origin = [0, 0];
  let target = { x: 0, y: 0 }, follow = { x: 0, y: 0 }, previous = { x: 0, y: 0 };
  let direction = { x: 1, y: 0 }, speed = 0;
  let resizeObserver, visibilityObserver;
  const retain = (kind, value) => { resources.push([kind, value]); return value; };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    listeners.abort();
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    resources.reverse().forEach(([kind, value]) => gl['delete' + kind](value));
    card.classList.remove('has-plan-reveal');
    canvas.remove();
  };

  try {
    const derivatives = gl.getExtension('OES_standard_derivatives');
    const vertex = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() { v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }
    `;
    const noise = `
      float hash(vec2 p) {
        vec3 q = fract(vec3(p.xyx)*0.1031);
        q += dot(q, q.yzx+33.33);
        return fract((q.x+q.y)*q.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x),
                   mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.)), f.x), f.y);
      }
      float terrain(vec2 p) {
        vec2 bend = vec2(noise(p*0.65), noise(p*0.65+8.3));
        p += (bend-0.5)*1.2;
        return noise(p)*0.94 + noise(p*1.9+4.7)*0.06;
      }
    `;
    function program(source, uniforms) {
      const result = retain('Program', gl.createProgram());
      [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, source]].forEach(([type, text]) => {
        const shader = retain('Shader', gl.createShader(type));
        gl.shaderSource(shader, text); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        gl.attachShader(result, shader);
      });
      gl.bindAttribLocation(result, 0, 'a_position');
      gl.linkProgram(result);
      if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result));
      return { program: result, ...Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(result, name)])) };
    }
    const field = program(`
      precision highp float;
      varying vec2 v_uv;
      uniform sampler2D u_previous;
      uniform vec2 u_size, u_from, u_to, u_direction, u_origin;
      uniform float u_dt, u_decay, u_radius, u_stretch, u_paint, u_time, u_flow;
      ${noise}
      void main() {
        vec2 flowPoint = (v_uv*u_size+u_origin)/u_radius + vec2(u_time*0.08, -u_time*0.06);
        float e = 0.08;
        vec2 curl = vec2(
          terrain(flowPoint+vec2(0.,e))-terrain(flowPoint-vec2(0.,e)),
          terrain(flowPoint-vec2(e,0.))-terrain(flowPoint+vec2(e,0.)))/(2.0*e);
        vec2 backtrace = clamp(v_uv-curl*u_flow*min(u_dt,0.05)/u_size, 0.0, 1.0);
        float old = dot(texture2D(u_previous, backtrace).rg, vec2(1.0, 1.0/255.0)) * exp(-u_decay * u_dt);
        // Distance to a continuous segment, stretched in the gesture's direction.
        vec2 p = v_uv * u_size - u_from;
        vec2 segment = u_to - u_from;
        vec2 normal = vec2(-u_direction.y, u_direction.x);
        vec2 q = vec2(dot(p, u_direction) / u_stretch, dot(p, normal));
        vec2 s = vec2(dot(segment, u_direction) / u_stretch, dot(segment, normal));
        float along = clamp(dot(q, s) / max(dot(s, s), 0.001), 0.0, 1.0);
        float distance = length(q - along * s) / u_radius;
        float deposit = exp(-2.8 * distance * distance) * u_paint;
        // Smooth union bridges nearby strokes; no new influence after movement stops.
        float join = max(0.16-abs(old-deposit), 0.0)/0.16;
        float merged = max(old, deposit) + join*join*0.04*u_paint*(1.0-exp(-60.0*u_dt));
        // Two-channel precision avoids an 8-bit decay plateau on high-refresh displays.
        float value = min(merged, 1.0) * 255.0;
        gl_FragColor = vec4(floor(value)/255.0, fract(value), 0.0, 1.0);
      }
    `, ['u_previous', 'u_size', 'u_from', 'u_to', 'u_direction', 'u_dt', 'u_decay', 'u_radius', 'u_stretch', 'u_paint', 'u_time', 'u_flow', 'u_origin']);
    const surface = program(`${derivatives ? '#extension GL_OES_standard_derivatives : enable' : ''}
      precision highp float;
      varying vec2 v_uv;
      uniform sampler2D u_base, u_alternate, u_mask;
      uniform vec2 u_size, u_baseSize, u_alternateSize, u_origin;
      uniform float u_time, u_radius, u_irregularity, u_edge, u_contours;
      ${noise}
      vec2 cover(vec2 uv, vec2 imageSize) {
        float fit = max(u_size.x / imageSize.x, u_size.y / imageSize.y);
        return (uv - 0.5) * u_size / (imageSize * fit) + 0.5;
      }
      void main() {
        vec2 p = (v_uv * u_size + u_origin) / u_radius;
        // Broad, domain-warped lobes form flowing ribbons instead of a ragged brush.
        vec2 drift = vec2(u_time * 0.08, -u_time * 0.06);
        vec2 warp = vec2(terrain(p*0.95+drift), terrain(p*0.95+drift+19.7)) - 0.5;
        vec2 stored = texture2D(u_mask, clamp(v_uv + warp*u_irregularity*u_radius*1.8/u_size, 0.0, 1.0)).rg;
        float field = dot(stored, vec2(1.0, 1.0/255.0));
        float pattern = terrain(p*1.7 + drift + warp*0.8);
        // Changing thresholds cut holes and narrow channels through the reveal.
        float threshold = 0.28 + (pattern-0.45)*u_irregularity*1.2;
        float pockets = smoothstep(0.54, 0.79, terrain(p*2.2-drift+11.2));
        float level = field-threshold-pockets*u_irregularity*1.65;
        float edge = ${derivatives ? 'max(u_edge, fwidth(level)*0.75)' : 'u_edge'};
        float mask = smoothstep(-edge, edge, level);
        vec4 base = texture2D(u_base, cover(v_uv, u_baseSize));
        vec4 alternate = texture2D(u_alternate, cover(v_uv, u_alternateSize));
        vec3 baseColor = mix(vec3(0.0706), base.rgb, base.a);
        vec3 alternateColor = mix(baseColor, alternate.rgb, alternate.a);
        // Fine isolines share the same spatial field. Only lines inside the trail
        // move; resting contours and texture UVs remain stable between gestures.
        float resting = terrain(p*1.15+vec2(3.2,7.1));
        float active = terrain(p*1.15+vec2(3.2,7.1)+warp*field*0.6);
        float contours = mix(resting, active, smoothstep(0.02,0.2,field));
        float bands = abs(fract(contours*4.0)-0.5);
        float lineWidth = ${derivatives ? 'max(fwidth(contours*4.0), 0.001)' : '0.014'};
        float line = 1.0-smoothstep(lineWidth*0.25,lineWidth*1.1,bands);
        vec3 color = mix(baseColor, alternateColor, mask);
        color += line * mix(vec3(0.052,0.039,0.030),vec3(0.17,0.09,0.035),mask) * u_contours;
        // A restrained warm rim makes the moving edge readable without a glow blur.
        float rim = (1.0-smoothstep(edge,edge*2.4,abs(level))) * smoothstep(0.08,0.25,field);
        color += rim*vec3(0.065,0.027,0.007);
        gl_FragColor = vec4(color, 1.0);
      }
    `, ['u_base', 'u_alternate', 'u_mask', 'u_size', 'u_baseSize', 'u_alternateSize', 'u_time', 'u_radius', 'u_irregularity', 'u_edge', 'u_contours', 'u_origin']);

    const quad = retain('Buffer', gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    function texture() {
      const value = retain('Texture', gl.createTexture());
      gl.bindTexture(gl.TEXTURE_2D, value);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return value;
    }
    function bind(value, unit) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, value);
    }
    // Default copper texture; replace either source using the card's data attributes.
    function defaultLayer(alternate) {
      const image = document.createElement('canvas');
      image.width = image.height = alternate ? 512 : 1;
      const ctx = image.getContext('2d');
      ctx.fillStyle = alternate ? '#36180b' : '#121212';
      ctx.fillRect(0, 0, image.width, image.height);
      if (alternate) {
        const glow = ctx.createRadialGradient(150, 350, 0, 260, 260, 430);
        glow.addColorStop(0, '#b24b10'); glow.addColorStop(0.4, '#813209'); glow.addColorStop(1, '#30180c');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 512);
        // Fine surface grain belongs to the texture, not to a moving blur.
        const data = ctx.getImageData(0, 0, 512, 512);
        for (let i = 0; i < data.data.length; i += 4) {
          const grain = ((Math.imul(i + 7, 16807) >>> 8) % 11) - 5;
          for (let channel = 0; channel < 3; channel++) data.data[i + channel] += grain;
        }
        ctx.putImageData(data, 0, 0);
      }
      return image;
    }
    function layer(source, alternate) {
      const result = { texture: texture(), size: [1, 1] };
      const upload = image => {
        if (disposed) return;
        bind(result.texture, 0);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        result.size = [image.naturalWidth || image.width, image.naturalHeight || image.height];
      };
      upload(defaultLayer(alternate));
      if (source) {
        const image = new Image(); image.crossOrigin = 'anonymous';
        image.onload = () => { try { upload(image); wake(); } catch (error) { console.warn('Plan texture:', error); } };
        image.src = source;
      }
      return result;
    }
    const base = layer(card.dataset.revealBase, false);
    const alternate = layer(card.dataset.revealAlternate, true);
    const buffers = [0, 1].map(() => ({ texture: texture(), framebuffer: retain('Framebuffer', gl.createFramebuffer()) }));
    function clear() {
      buffers.forEach(buffer => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.framebuffer);
        gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    function draw(now) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(surface.program);
      bind(base.texture, 0); bind(alternate.texture, 1); bind(buffers[readIndex].texture, 2);
      gl.uniform1i(surface.u_base, 0); gl.uniform1i(surface.u_alternate, 1); gl.uniform1i(surface.u_mask, 2);
      gl.uniform2f(surface.u_size, width, height);
      gl.uniform2fv(surface.u_origin, origin);
      gl.uniform2fv(surface.u_baseSize, base.size); gl.uniform2fv(surface.u_alternateSize, alternate.size);
      gl.uniform1f(surface.u_time, now / 1000);
      gl.uniform1f(surface.u_radius, settings.radius);
      gl.uniform1f(surface.u_irregularity, settings.irregularity);
      gl.uniform1f(surface.u_edge, Math.max(settings.edgeSoftness, 0.65 / settings.radius));
      gl.uniform1f(surface.u_contours, card.dataset.revealBase || card.dataset.revealAlternate ? 0 : settings.contourStrength);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    function tick(now) {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      const dt = Math.max(0.001, (now - lastFrame) / 1000); lastFrame = now;
      const alpha = 1 - Math.exp(-dt / settings.followDelay);
      previous = { ...follow };
      follow.x += (target.x-follow.x)*alpha; follow.y += (target.y-follow.y)*alpha;
      const distance = Math.hypot(follow.x-previous.x, follow.y-previous.y);
      const paint = hasPoint && (now-lastMove < 70 || distance > 0.35) && now-lastMove < 500;
      if (paint) lastDeposit = now;
      speed *= Math.exp(-dt * 5);
      const output = buffers[1-readIndex];
      gl.bindFramebuffer(gl.FRAMEBUFFER, output.framebuffer);
      gl.viewport(0, 0, maskWidth, maskHeight); gl.useProgram(field.program);
      bind(buffers[readIndex].texture, 0); gl.uniform1i(field.u_previous, 0);
      gl.uniform2f(field.u_size, width, height);
      gl.uniform2fv(field.u_origin, origin);
      gl.uniform2f(field.u_from, previous.x, previous.y); gl.uniform2f(field.u_to, follow.x, follow.y);
      gl.uniform2f(field.u_direction, direction.x, direction.y);
      gl.uniform1f(field.u_dt, dt);
      gl.uniform1f(field.u_decay, 1.28 * settings.dissipation / settings.trailDuration);
      gl.uniform1f(field.u_radius, settings.radius);
      gl.uniform1f(field.u_stretch, 1 + Math.min(speed / 1400, 1.8)*settings.velocityStretch);
      gl.uniform1f(field.u_paint, paint ? 1 : 0);
      gl.uniform1f(field.u_time, now / 1000);
      gl.uniform1f(field.u_flow, settings.flowStrength);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); readIndex = 1-readIndex;
      draw(now);
      if (now-lastDeposit < settings.trailDuration/settings.dissipation*3200) frame = requestAnimationFrame(tick);
      else { clear(); draw(now); }
    }
    function wake() {
      if (!frame && !disposed && visible && !document.hidden) {
        lastFrame = performance.now(); frame = requestAnimationFrame(tick);
      }
    }
    function resize() {
      width = card.clientWidth; height = card.clientHeight;
      // Continue one decorative field across the section instead of tiling each card.
      const section = card.closest('section').getBoundingClientRect();
      const rect = card.getBoundingClientRect();
      origin = [rect.left-section.left, section.bottom-rect.bottom];
      const ratio = Math.min(window.devicePixelRatio || 1, settings.maxPixelRatio);
      canvas.width = Math.max(1, Math.round(width*ratio)); canvas.height = Math.max(1, Math.round(height*ratio));
      maskWidth = Math.max(1, Math.round(width*settings.maskResolution)); maskHeight = Math.max(1, Math.round(height*settings.maskResolution));
      buffers.forEach(buffer => {
        bind(buffer.texture, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, maskWidth, maskHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, buffer.texture, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Plan mask framebuffer unavailable');
      });
      clear(); hasPoint = false; draw(performance.now());
    }
    card.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      const rect = card.getBoundingClientRect(), now = performance.now();
      const point = { x: event.clientX-rect.left-card.clientLeft, y: height-(event.clientY-rect.top-card.clientTop) };
      if (!inside || !hasPoint || now-lastMove > 160) { follow = { ...point }; target = { ...point }; speed = 0; }
      const dx = point.x-target.x, dy = point.y-target.y, length = Math.hypot(dx, dy);
      if (length > 0.1) {
        direction = { x: dx/length, y: dy/length };
        speed = Math.min(3000, length / Math.max((now-lastMove)/1000, 0.008));
      }
      target = point; inside = true; hasPoint = true; lastMove = now; wake();
    }, { passive: true, signal: listeners.signal });
    card.addEventListener('pointerleave', () => { inside = false; }, { signal: listeners.signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; inside = false; hasPoint = false; clear(); }
      else { draw(performance.now()); }
    }, { signal: listeners.signal });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); dispose(); }, { signal: listeners.signal });
    card.prepend(canvas);
    resize();
    card.classList.add('has-plan-reveal');
    resizeObserver = new ResizeObserver(() => {
      try { resize(); } catch (error) { console.warn('Plan reveal resize:', error); dispose(); }
    });
    resizeObserver.observe(card);
    visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) { cancelAnimationFrame(frame); frame = 0; inside = false; hasPoint = false; clear(); draw(performance.now()); }
    });
    visibilityObserver.observe(card);
    return dispose;
  } catch (error) {
    console.warn('Plan reveal unavailable; keeping the static surface.', error);
    dispose();
    return () => {};
  }
}
