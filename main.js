/* ════════════════════════════════════════════════════════════════
   GT BARBEARIA — MAIN JAVASCRIPT
   Preloader · WebGL Shaders · GSAP · Lenis Smooth Scroll
════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   1. GSAP Plugin Registration (free only)
───────────────────────────────────────── */
gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────────
   2. PRELOADER — WebGL fire shader
───────────────────────────────────────── */
(function initPreloaderCanvas() {
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
  function prepareHeroSilently(onReady) {
    initHeroShader();
    initLenis();
    initBarberScrollEffects();
    initBarberHover();
    requestAnimationFrame(() => requestAnimationFrame(onReady));
  }
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
  const canvas = document.getElementById('hero-canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  
  // Debounce resize para melhor performance
  let resizeTimeout;
  const debouncedResize = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(resize, 150);
  };
  window.addEventListener('resize', debouncedResize, { passive: true });

  let mouse = { x: 0.5, y: 0.5 };
  let smooth = { x: 0.5, y: 0.5 };

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = 1.0 - e.clientY / window.innerHeight;
  }, { passive: true });

  const vsSource = `attribute vec4 a_position; void main(){gl_Position=a_position;}`;

  const fsSource = `
    precision mediump float;
    uniform float u_time;
    uniform vec2  u_resolution;
    uniform vec2  u_mouse;

    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);
      f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    float fbm(vec2 p){
      float v=0.0,a=0.5;
      for(int i=0;i<4;i++){v+=a*noise(p);p*=2.1;a*=0.45;}
      return v;
    }
    void main(){
      vec2 uv=gl_FragCoord.xy/u_resolution;
      vec2 m=u_mouse-0.5;
      vec2 wuv=uv+m*0.05;
      float t=u_time*0.12;
      vec2 q=vec2(fbm(wuv*1.8+t),fbm(wuv*1.8+vec2(1.7,9.2)+t));
      float f=fbm(wuv*1.5+1.5*q);
      float vign=1.0-smoothstep(0.25,0.95,length(uv-0.5)*1.7);
      float md=length(uv-u_mouse);
      float mg=exp(-md*6.0)*0.25;
      vec3 dark=vec3(0.04,0.02,0.01);
      vec3 orng=vec3(1.0,0.42,0.0);
      vec3 col=mix(dark,orng,f*vign*0.48);
      col+=orng*mg;
      col+=orng*0.02*vign;
      col=mix(dark,col,0.7+vign*0.3);
      gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
    }
  `;

  function mkShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s); return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, mkShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const pos = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  const uT = gl.getUniformLocation(prog, 'u_time');
  const uR = gl.getUniformLocation(prog, 'u_resolution');
  const uM = gl.getUniformLocation(prog, 'u_mouse');
  const t0 = performance.now();

  (function loop() {
    requestAnimationFrame(loop);
    smooth.x += (mouse.x - smooth.x) * 0.04;
    smooth.y += (mouse.y - smooth.y) * 0.04;
    gl.uniform1f(uT, (performance.now() - t0) / 1000);
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform2f(uM, smooth.x, smooth.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  })();
}

/* ─────────────────────────────────────────
   5. LENIS SMOOTH SCROLL
───────────────────────────────────────── */
function initLenis() {
  const lenis = new Lenis({
    duration: 0.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: true,
  });

  // Connect Lenis to GSAP ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/* ─────────────────────────────────────────
   6. BARBER SCROLL PARALLAX + OUTLINE DELAY
───────────────────────────────────────── */
function initBarberScrollEffects() {
  const cards = document.querySelectorAll('.barber-card');

  cards.forEach(card => {
    const imgWrap = card.querySelector('.barber-img-wrap');
    const outline = card.querySelector('.barber-outline');
    const isCenter = card.classList.contains('center');
    const speed = isCenter ? -130 : -85;

    // Image rises on scroll — otimizado com scrub reduzido
    gsap.to(imgWrap, {
      y: speed,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: 0.5,  // Reduzido para melhor performance
        fastScrollEnd: true,
      }
    });

    // Outline follows with delay — otimizado
    gsap.to(outline, {
      y: speed * 0.82,
      opacity: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: '#hero',
        start: 'top+=80 top',
        end: 'bottom top',
        scrub: 2,  // Reduzido de 4 para melhor performance
        fastScrollEnd: true,
      }
    });
  });
}

/* ─────────────────────────────────────────
   7. BARBER HOVER — pure GSAP
───────────────────────────────────────── */
function initBarberHover() {
  document.querySelectorAll('.barber-card').forEach(card => {
    const img = card.querySelector('.barber-img');

    card.addEventListener('mouseenter', () => {
      gsap.to(img, { scale: 1.08, y: -12, duration: 0.55, ease: 'power3.out' });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(img, { scale: 1, y: 0, duration: 0.75, ease: 'power3.inOut' });
    });
  });
}

/* ─────────────────────────────────────────
   8. HERO ENTRY ANIMATIONS
   — Chamada APÓS o preloader sair completamente
   — Hero já está renderizado e sem jank
───────────────────────────────────────── */
function initHeroAnimations() {
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
    .from('.barber-card', {
      opacity: 0, y: 100, scale: 0.94,
      duration: 1.1, ease: 'power4.out',
      stagger: { amount: 0.3, from: 'center' },
      immediateRender: false,
    }, '-=0.35');
}

/* ─────────────────────────────────────────
   9. SOBRE NÓS SCROLL ANIMATIONS
───────────────────────────────────────── */
function initSobreNosAnimations() {
  // Image parallax + fade — otimizado
  gsap.from('.sobre-nos-image', {
    opacity: 0, x: -60, duration: 0.9,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#sobre-nos',
      start: 'top 70%',
      end: 'top 30%',
      toggleActions: 'play none none none',
      fastScrollEnd: true,
    }
  });

  // Content fade and slide — otimizado
  gsap.from('.sobre-nos-content', {
    opacity: 0, x: 60, duration: 0.9,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#sobre-nos',
      start: 'top 70%',
      end: 'top 30%',
      toggleActions: 'play none none none',
      fastScrollEnd: true,
    }
  });

  // Staggered values animation — otimizado
  gsap.from('.valor-item', {
    opacity: 0, y: 30,
    duration: 0.6, ease: 'power3.out',
    stagger: 0.12,
    scrollTrigger: {
      trigger: '.sobre-valores',
      start: 'top 80%',
      toggleActions: 'play none none none',
      fastScrollEnd: true,
    }
  });
}

// Chama as animações do sobre nós quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
  initSobreNosAnimations();
});