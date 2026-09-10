/* ════════════════════════════════════════════════════════════════
   GT BARBEARIA — MAIN JAVASCRIPT
   Preloader · WebGL Shaders · GSAP · Lenis Smooth Scroll
════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   1. GSAP Plugin Registration (free only)
───────────────────────────────────────── */
gsap.registerPlugin(ScrollTrigger);
const DESKTOP_MOTION_QUERY = '(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

/* ─────────────────────────────────────────
   2. PRELOADER — WebGL fire shader
───────────────────────────────────────── */
(function initPreloaderCanvas() {
  if (!window.matchMedia(DESKTOP_MOTION_QUERY).matches) return;
  const canvas = document.getElementById('preloader-canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  window.addEventListener('resize', resize);

  const vsSource = `
    attribute vec4 a_position;
    void main() { gl_Position = a_position; }
  `;

  const fsSource = `
    precision mediump float;
    uniform float u_time;
    uniform vec2  u_resolution;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
      return v;
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float t = u_time * 0.3;
      vec2 q = vec2(fbm(uv + t), fbm(uv + vec2(1.7, 9.2) + t));
      float f = fbm(uv + 1.8 * q);
      float center = 1.0 - length(uv - 0.5) * 1.4;
      center = clamp(center, 0.0, 1.0);
      vec3 orange = vec3(1.0, 0.42, 0.0);
      vec3 dark   = vec3(0.04, 0.02, 0.0);
      vec3 col    = mix(dark, orange, f * center * 0.6);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s); return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');

  const start = performance.now();
  let raf;

  function renderLoop() {
    raf = requestAnimationFrame(renderLoop);
    const t = (performance.now() - start) / 1000;
    gl.uniform1f(uTime, t);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  renderLoop();

  window._stopPreloaderGL = () => cancelAnimationFrame(raf);
})();

/* ─────────────────────────────────────────
   3. PRELOADER SEQUENCE
   — Aguarda carregamento REAL das imagens
   — Pré-inicializa hero antes de sair
   — Zero travamento na transição
───────────────────────────────────────── */
(function initPreloader() {
  const bar = document.getElementById('preloader-bar');
  const preloader = document.getElementById('preloader');
  const gtText = document.querySelector('#preloader-logo .gt-logo-text');

  // ── Animação de entrada do logo ──
  gsap.from(gtText, {
    opacity: 0, scale: 0.5, duration: 1,
    ease: 'power4.out', delay: 0.3
  });

  // ── 1. Precarrega todas as imagens dos barbeiros ──
  const imageSrcs = [
    'essencial/gt-barbearia-lettering-v2.png',
    'essencial/yuri.png',
    'essencial/gulherme.png',
    'essencial/zidane.png',
  ];

  const imagesReady = Promise.all(
    imageSrcs.map(src => new Promise(resolve => {
      const img = new Image();
      img.src = src;
      img.onload = resolve;
      img.onerror = resolve; // não travar se falhar
    }))
  );
  // ── 3. Inicializa o hero (shader + Lenis + ScrollTrigger)
  // ── 2. Barra de progresso simulada — trava em 88% até imagens prontas ──
  const LOCK_AT = 88;
  let fakeProgress = 0;
  let imagesLoaded = false;
  let canComplete = false;

  imagesReady.then(() => {
    imagesLoaded = true;
    // se a barra já passou do ponto de trava, completa imediatamente
    if (canComplete) completeFill();
  });

  const interval = setInterval(() => {
    const ceiling = imagesLoaded ? 100 : LOCK_AT;
    const step = Math.random() * 14 + 4;
    fakeProgress = Math.min(fakeProgress + step, ceiling);
    bar.style.width = fakeProgress + '%';

    if (fakeProgress >= LOCK_AT && !imagesLoaded) {
      // chegou no teto, aguarda imagens
      canComplete = true;
      clearInterval(interval);
    }

    if (fakeProgress >= 100) {
      clearInterval(interval);
      // Pré-inicializa o hero ANTES de qualquer transição visual
      // para que tudo esteja pronto quando o preloader sair
      prepareHeroSilently(() => {
        setTimeout(dismissPreloader, 300);
      });
    }
  }, 100);

  function completeFill() {
    // Anima os últimos % de forma rápida e suave
    const remaining = 100 - fakeProgress;
    const steps = Math.ceil(remaining / 8);
    let i = 0;
    const fill = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + (remaining / steps), 100);
      bar.style.width = fakeProgress + '%';
      i++;
      if (i >= steps) {
        clearInterval(fill);
        prepareHeroSilently(() => {
          setTimeout(dismissPreloader, 300);
        });
      }
    }, 40);
  }

  // ── 3. Inicializa o hero (shader + Lenis + ScrollTrigger)
  //       silenciosamente, SEM mostrar nada ainda ──
  function prepareHeroSilently(onReady) {
    // Garante que a section hero existe e está oculta via opacity
    // (já é opacity:0 por padrão via GSAP `from`)
    initHeroShader();
    initLenis();
    initBarberScrollEffects();
    initBarberHover();
    // Usa requestAnimationFrame para garantir que o browser
    // terminou de pintar o frame antes de chamar o callback
    requestAnimationFrame(() => requestAnimationFrame(onReady));
  }

  // ── 4. Saída do preloader + animações de entrada ──
  function dismissPreloader() {
    window._stopPreloaderGL && window._stopPreloaderGL();

    const navLogoEl = document.querySelector('.gt-logo-nav');
    const plLogoEl = gtText;
    const navRect = navLogoEl.getBoundingClientRect();
    const plRect = plLogoEl.getBoundingClientRect();

    const scaleX = navRect.width / plRect.width;
    const scaleY = navRect.height / plRect.height;
    const dx = navRect.left + navRect.width / 2 - (plRect.left + plRect.width / 2);
    const dy = navRect.top + navRect.height / 2 - (plRect.top + plRect.height / 2);

    // Fade out barra e label
    gsap.to(['#preloader-bar-wrap', '#preloader-label'], {
      opacity: 0, duration: 0.3, ease: 'power2.in'
    });

    // GT voa para o nav
    gsap.to(plLogoEl, {
      x: dx, y: dy,
      scaleX, scaleY,
      duration: 0.9,
      delay: 0.25,
      ease: 'power3.inOut',
      onComplete: () => {
        // Fade out do preloader — hero já está pronto por baixo
        gsap.to(preloader, {
          opacity: 0,
          duration: 0.55,
          ease: 'power2.inOut',
          onComplete: () => {
            preloader.style.display = 'none';
            // Dispara as animações de entrada agora que o
            // hero está 100% visível e sem travamento
            initHeroAnimations();
          }
        });
      }
    });
  }
})();

/* ─────────────────────────────────────────
   4. HERO WEBGL BACKGROUND — mouse-reactive
───────────────────────────────────────── */
function initHeroShader() {
  const desktopMotion = window.matchMedia(DESKTOP_MOTION_QUERY);
  if (!desktopMotion.matches) return;
  const hero = document.getElementById('hero');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0.5, y: 0.4 };
  const smooth = { ...pointer };
  const vertex = 'attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0.0,1.0);}';
  const noiseSource = `
    precision mediump float;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),
        mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);
    }
    float fbm(vec2 p){
      float v=0.0,a=0.5;
      for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(3.1,1.7);a*=0.5;}
      return v;
    }
  `;
  const background = noiseSource + `
    void main(){
      vec2 uv=gl_FragCoord.xy/u_resolution;
      float t=u_time*0.028;
      vec2 p=uv*vec2(3.2,2.2)+(u_mouse-0.5)*0.08;
      vec2 warp=vec2(fbm(p+vec2(t,-t)),fbm(p+vec2(7.3,-t*0.7)));
      float cloud=fbm(p+warp*1.4+vec2(-t,t*0.4));
      float texture=smoothstep(0.35,0.75,cloud);
      float edge=1.0-smoothstep(0.30,0.78,length((uv-0.5)*vec2(1.0,0.85)));
      vec2 lightDelta=(uv-u_mouse)*vec2(u_resolution.x/u_resolution.y,1.0);
      float halo=exp(-dot(lightDelta,lightDelta)*14.0);
      float sides=smoothstep(0.15,0.5,abs(uv.x-0.5));
      vec3 col=vec3(0.024,0.012,0.008);
      col+=vec3(0.30,0.095,0.014)*smoothstep(0.20,0.75,cloud)*edge;
      col+=vec3(0.12,0.034,0.005)*texture*sides*edge;
      col+=vec3(0.38,0.14,0.022)*halo;
      col*=0.65+0.35*smoothstep(0.0,0.2,uv.y);
      gl_FragColor=vec4(col,1.0);
    }
  `;
  function createLayer(canvas, fragment, alpha) {
    const gl=canvas.getContext('webgl', { alpha, premultipliedAlpha: false, antialias: false });
    if (!gl) return null;
    const program=gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader=gl.createShader(type);
      gl.shaderSource(shader,source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
        console.warn('Hero shader unavailable:',gl.getShaderInfoLog(shader));
        gl.deleteShader(shader); gl.deleteProgram(program); return null;
      }
      gl.attachShader(program,shader); gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {
      gl.deleteProgram(program); return null;
    }
    gl.useProgram(program);
    const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'a_position');
    gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    return { canvas, gl, time:gl.getUniformLocation(program,'u_time'),
      resolution:gl.getUniformLocation(program,'u_resolution'),mouse:gl.getUniformLocation(program,'u_mouse') };
  }
  const layers=[createLayer(document.getElementById('hero-canvas'),background,false)].filter(Boolean);
  let frame=0, previous=0, elapsed=0, visible=true;
  function render(now) {
    frame=0;
    if (!visible || document.hidden || !desktopMotion.matches) { previous=0; return; }
    if (previous && now-previous<32) { frame=requestAnimationFrame(render); return; }
    if (previous && !motion.matches) elapsed+=Math.min(now-previous,100)/1000;
    previous=now;
    smooth.x+=(pointer.x-smooth.x)*0.14; smooth.y+=(pointer.y-smooth.y)*0.14;
    for (const layer of layers) {
      const {gl,canvas}=layer;
      gl.uniform1f(layer.time,motion.matches ? 0 : elapsed);
      gl.uniform2f(layer.resolution,canvas.width,canvas.height);
      gl.uniform2f(layer.mouse,smooth.x,smooth.y);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
    if (!motion.matches) frame=requestAnimationFrame(render);
  }
  function wake() { if (!frame && visible && !document.hidden && desktopMotion.matches) frame=requestAnimationFrame(render); }
  function resize() {
    for (const {canvas,gl} of layers) {
      const rect=canvas.getBoundingClientRect();
      const scale=Math.min(window.devicePixelRatio || 1,1.25,1440/Math.max(rect.width,1));
      canvas.width=Math.max(1,Math.round(rect.width*scale));
      canvas.height=Math.max(1,Math.round(rect.height*scale));
      gl.viewport(0,0,canvas.width,canvas.height);
    }
    wake();
  }
  hero.addEventListener('pointermove', event=>{
    if (motion.matches || event.pointerType==='touch') return;
    const rect=hero.getBoundingClientRect();
    pointer.x=(event.clientX-rect.left)/rect.width;
    pointer.y=1-(event.clientY-rect.top)/rect.height;
  },{passive:true});
  hero.addEventListener('pointerleave',()=>{pointer.x=0.5;pointer.y=0.4;});
  new ResizeObserver(resize).observe(hero);
  hero.querySelectorAll('.barber-img').forEach(img=>img.addEventListener('load',resize,{once:true}));
  document.fonts.ready.then(resize);
  new IntersectionObserver(([entry])=>{
    visible=entry.isIntersecting;
    if (!visible) { cancelAnimationFrame(frame); frame=0; previous=0; } else wake();
  }).observe(hero);
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) { cancelAnimationFrame(frame); frame=0; previous=0; } else wake();
  });
  motion.addEventListener('change',()=>{previous=0;wake();});
  desktopMotion.addEventListener('change', () => {
    cancelAnimationFrame(frame); frame=0; previous=0; wake();
  });
  resize();
}

let desktopLenis = null;

function initLenis() {
  // Touch scrolling stays entirely native; desktop smoothing has a clean teardown.
  gsap.matchMedia().add(DESKTOP_MOTION_QUERY, () => {
    const lenis = new Lenis({
      duration: 0.6,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
    });
    desktopLenis = lenis;
    const tick = time => lenis.raf(time * 1000);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      desktopLenis = null;
      lenis.destroy();
    };
  });
}

function initBarberScrollEffects() {
  gsap.matchMedia().add(DESKTOP_MOTION_QUERY, () => {
    gsap.to('.hero-brand', {
      y: -70, opacity: 0.25, ease: 'none',
      scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 0.8 }
    });
    document.querySelectorAll('.barber-card').forEach(card => {
      const speed = card.classList.contains('center') ? -130 : -85;
      gsap.to(card.querySelector('.barber-img-wrap'), {
        y: speed, ease: 'none',
        scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 0.5 }
      });
      gsap.to(card.querySelector('.barber-outline'), {
        y: speed * 0.82, opacity: 1, ease: 'none',
        scrollTrigger: { trigger: '#hero', start: 'top+=80 top', end: 'bottom top', scrub: 2 }
      });
    });
  });
}

function initBarberHover() {
  gsap.matchMedia().add(DESKTOP_MOTION_QUERY, () => {
    const cleanups = [];
    document.querySelectorAll('.barber-card').forEach(card => {
      const img = card.querySelector('.barber-img');
      const enter = () => gsap.to(img, { scale: 1.08, y: -12, duration: 0.55, ease: 'power3.out', overwrite: 'auto' });
      const leave = () => gsap.to(img, { scale: 1, y: 0, duration: 0.75, ease: 'power3.inOut', overwrite: 'auto' });
      card.addEventListener('mouseenter', enter);
      card.addEventListener('mouseleave', leave);
      cleanups.push(() => {
        card.removeEventListener('mouseenter', enter);
        card.removeEventListener('mouseleave', leave);
        gsap.killTweensOf(img);
        gsap.set(img, { clearProps: 'transform' });
      });
    });
    return () => cleanups.forEach(cleanup => cleanup());
  });
}

function initHeroAnimations() {
  if (!window.matchMedia(DESKTOP_MOTION_QUERY).matches) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.from('.hero-brand, .barber-card, .hero-actions', { opacity: 0, duration: 0.45, stagger: 0.05, clearProps: 'opacity' });
    }
    return;
  }
  // immediateRender:false garante que o GSAP seta os estados iniciais
  // APENAS quando a animação começa, não antes
  const tl = gsap.timeline({ delay: 0.05 });

  tl.from('.gt-logo-nav', {
    opacity: 0, x: -30, duration: 0.7,
    ease: 'power3.out',
    immediateRender: false,
  })
    .from('.nav-link', {
      opacity: 0, y: -12, stagger: 0.07, duration: 0.55,
      ease: 'power3.out',
      immediateRender: false,
    }, '-=0.45')
    .from('.social-icon', {
      opacity: 0, x: 18, stagger: 0.09, duration: 0.55,
      ease: 'power3.out',
      immediateRender: false,
    }, '-=0.45')
    .from('.hero-title-word', {
      opacity: 0,
      y: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 45,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.95,
      stagger: 0.12,
      ease: 'power4.out',
      immediateRender: false,
    }, '-=0.35')
    .from('.barber-card', {
      opacity: 0, y: 100, scale: 0.94,
      duration: 1.1, ease: 'power4.out',
      stagger: { amount: 0.3, from: 'center' },
      immediateRender: false,
    }, '-=0.35');

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tl.from('.hero-actions > *', { opacity: 0, y: 12, duration: 0.6, stagger: 0.12, ease: 'power2.out', immediateRender: false }, '-=0.4');
  }
}

/* ─────────────────────────────────────────
   9. SOBRE NÓS SCROLL ANIMATIONS
───────────────────────────────────────── */
function initSobreNosAnimations() {
  gsap.matchMedia().add(DESKTOP_MOTION_QUERY, () => {
    gsap.fromTo('.sobre-img', { scale: 1.07, yPercent: -2 }, {
      scale: 1.07, yPercent: 2, ease: 'none',
      scrollTrigger: { trigger: '.sobre-photo', start: 'top bottom', end: 'bottom top', scrub: 0.8 }
    });
  });
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    gsap.from('.sobre-section-label', {
      opacity: 0, y: 16, duration: 0.65, ease: 'power2.out',
      scrollTrigger: { trigger: '#sobre-nos', start: 'top 82%', once: true }
    });
    gsap.from('.sobre-titulo > span', {
      opacity: 0, y: 36, duration: 0.85, stagger: 0.12, ease: 'power3.out',
      scrollTrigger: { trigger: '.sobre-nos-content', start: 'top 85%', once: true }
    });
    gsap.from('.sobre-copy, .sobre-signature', {
      opacity: 0, y: 20, duration: 0.7, stagger: 0.12, ease: 'power2.out',
      scrollTrigger: { trigger: '.sobre-copy', start: 'top 88%', once: true }
    });
    gsap.from('.sobre-photo', {
      y: 18, opacity: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: '.sobre-photo', start: 'top 85%', once: true }
    });

    gsap.from('.valor-item', {
      opacity: 0, y: 20, duration: 0.6, stagger: 0.12, ease: 'power2.out',
      scrollTrigger: { trigger: '.sobre-valores', start: 'top 92%', once: true }
    });
  });
}

function initSobreAlbum() {
  const stage = document.getElementById('sobre-album');
  const button = stage.querySelector('.album-next');
  const cards = [...stage.querySelectorAll('.album-photo')];
  const caption = document.querySelector('.album-date');
  const error = document.querySelector('.album-error');
  let current = 0;
  let busy = false;
  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    button.disabled = true;
    stage.setAttribute('aria-busy', 'true');
    error.hidden = true;
    const next = (current + 1) % cards.length;
    const image = cards[next].querySelector('img');
    try {
      await image.decode();
      cards.forEach((card, index) => card.setAttribute('aria-hidden', String(index !== next)));
      stage.dataset.current = String(next);
      if (next === 1) {
        caption.textContent = 'Atualmente';
      } else {
        const date = document.createElement('time');
        date.dateTime = '2021-07-21';
        date.textContent = '21 de julho de 2021';
        caption.replaceChildren(date);
      }
      button.setAttribute('aria-label', next === 1 ? 'Mostrar foto de 21 de julho de 2021' : 'Mostrar foto atual da barbearia');
      current = next;
    } catch {
      error.hidden = false;
    } finally {
      busy = false;
      button.disabled = false;
      stage.setAttribute('aria-busy', 'false');
    }
  });
}

function initPlansAnimations() {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    gsap.from('.plans-section-label, .plans-title', {
      opacity: 0, y: 20, duration: 0.7, stagger: 0.1, ease: 'power3.out',
      scrollTrigger: { trigger: '#planos', start: 'top 82%', once: true }
    });
    document.querySelectorAll('.plan-card').forEach(card => {
      gsap.from(card, {
        opacity: 0, y: 24, duration: 0.7, ease: 'power3.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: card, start: 'top 90%', once: true }
      });
    });
  });
  gsap.matchMedia().add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
    const cleanups = [];
    document.querySelectorAll('.plan-card').forEach(card => {
      const move = event => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--plan-x', (event.clientX - rect.left) + 'px');
        card.style.setProperty('--plan-y', (event.clientY - rect.top) + 'px');
      };
      const reset = () => { card.style.removeProperty('--plan-x'); card.style.removeProperty('--plan-y'); };
      card.addEventListener('pointermove', move, { passive: true });
      card.addEventListener('pointerleave', reset);
      cleanups.push(() => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerleave', reset); reset(); });
    });
    return () => cleanups.forEach(cleanup => cleanup());
  });
}

function initFooterAnimations() {
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    document.querySelectorAll('.footer-section-label, .locations-title, .location-card, .footer-contact-intro, .footer-contact-links').forEach(element => {
      gsap.from(element, {
        opacity: 0, y: 20, duration: 0.7, ease: 'power3.out', clearProps: 'transform,opacity',
        scrollTrigger: { trigger: element, start: 'top 92%', once: true }
      });
    });
  });
}

function initAnchorNavigation() {
  let animation = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cancel = () => { if (animation) { animation.kill(); animation = null; } };
  const setScroll = y => {
    if (desktopLenis) desktopLenis.scrollTo(y, { immediate: true });
    else window.scrollTo({ top: y, behavior: 'instant' });
  };
  window.addEventListener('wheel', cancel, { passive: true });
  window.addEventListener('touchstart', cancel, { passive: true });
  window.addEventListener('keydown', event => {
    if (['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancel();
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const hash = link.getAttribute('href');
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    cancel();
    const offset = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const destination = Math.max(0, Math.min(maxScroll, window.scrollY + target.getBoundingClientRect().top - offset));
    const finish = () => {
      animation = null;
      if (window.location.hash !== hash) history.pushState(null, '', hash);
      const needsTabIndex = !target.hasAttribute('tabindex');
      if (needsTabIndex) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (needsTabIndex) target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    };
    if (reducedMotion.matches || Math.abs(destination - window.scrollY) < 2) {
      setScroll(destination);
      finish();
      return;
    }
    const position = { y: window.scrollY };
    animation = gsap.to(position, {
      y: destination, duration: 0.55, ease: 'power2.inOut',
      onUpdate: () => setScroll(position.y),
      onComplete: finish,
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAnchorNavigation();
  initFooterAnimations();
  initPlansAnimations();
  initSobreAlbum();
  initSobreNosAnimations();
});