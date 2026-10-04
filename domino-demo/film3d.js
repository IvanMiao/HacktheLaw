/* Domino 3D intro: ivory dominoes on a glossy black floor, a curved run toppled by simple rigid-body rules. */
window.film3D=function(canvas,hooks){
  const T=window.THREE;if(!T)return null;
  let R;try{R=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(e){return null;}
  if(!R.getContext())return null;
  const W=()=>canvas.clientWidth||innerWidth,H=()=>canvas.clientHeight||innerHeight;
  R.setPixelRatio(Math.min(devicePixelRatio||1,2));R.setSize(W(),H(),false);
  R.toneMapping=T.ACESFilmicToneMapping;R.toneMappingExposure=1.18;
  R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
  const scene=new T.Scene(),BG=0x04050a;
  scene.background=new T.Color(BG);scene.fog=new T.Fog(BG,7,24);

  /* studio environment for reflections: dark room, soft boxes */
  const pm=new T.PMREMGenerator(R),es=new T.Scene();
  es.add(new T.Mesh(new T.BoxGeometry(40,16,40),new T.MeshBasicMaterial({color:0x07080b,side:T.BackSide})));
  const box=(w,h,x,y,z,rx,ry,c)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:new T.Color().setRGB(c,c,c*1.04),side:T.DoubleSide}));m.position.set(x,y,z);m.rotation.set(rx,ry,0);es.add(m);};
  box(18,4,0,7.5,0,Math.PI/2,0,3.2);box(3,10,-14,4,-6,0,Math.PI/2,1.6);box(3,10,14,4,4,0,-Math.PI/2,1.2);box(10,2,0,3,-18,0,0,1.0);
  const env=pm.fromScene(es,.035).texture;scene.environment=env;

  /* domino faces drawn on canvases */
  const PIPS=[[],[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];
  function face(a,b,o){
    o=o||{};const c=document.createElement('canvas');c.width=256;c.height=512;const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,256,512);g.addColorStop(0,o.f1||'#fbf8f1');g.addColorStop(1,o.f2||'#e9e3d6');x.fillStyle=g;x.fillRect(0,0,256,512);
    x.fillStyle='rgba(0,0,0,.42)';x.fillRect(26,253,204,5);x.fillStyle='rgba(255,255,255,.55)';x.fillRect(26,258,204,2);
    const rv=x.createRadialGradient(124,252,2,128,256,15);rv.addColorStop(0,'#f6e3a6');rv.addColorStop(.6,'#b8954a');rv.addColorStop(1,'#6e5726');x.fillStyle=rv;x.beginPath();x.arc(128,256,13,0,7);x.fill();
    const pip=(n,y0)=>PIPS[n].forEach(k=>{const cx=64+(k%3)*64,cy=y0+64+Math.floor(k/3)*64;
      const pg=x.createRadialGradient(cx-6,cy-7,2,cx,cy,23);pg.addColorStop(0,o.p1||'#3b3d44');pg.addColorStop(.75,o.p2||'#0d0e12');pg.addColorStop(1,o.p3||'#26272c');
      x.fillStyle=pg;x.beginPath();x.arc(cx,cy,21,0,7);x.fill();});
    pip(a,0);pip(b,256);
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
  }
  function geo(w,h,t){
    const b=Math.min(.035,t*.22),r=.05,s=new T.Shape(),x0=-w/2+b,x1=w/2-b,y0=b,y1=h-b;
    s.moveTo(x0+r,y0);s.lineTo(x1-r,y0);s.quadraticCurveTo(x1,y0,x1,y0+r);s.lineTo(x1,y1-r);s.quadraticCurveTo(x1,y1,x1-r,y1);
    s.lineTo(x0+r,y1);s.quadraticCurveTo(x0,y1,x0,y1-r);s.lineTo(x0,y0+r);s.quadraticCurveTo(x0,y0,x0+r,y0);
    const g=new T.ExtrudeGeometry(s,{depth:t-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:4,curveSegments:5});
    const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/w+.5,uv.getY(i)/h);
    g.translate(0,0,-(t-b));g.rotateY(Math.PI/2);return g;   /* body spans x∈[-t,0]: the pivot is the front-bottom edge */
  }
  const ivory=new T.MeshPhysicalMaterial({color:0xeee8dc,roughness:.34,clearcoat:1,clearcoatRoughness:.14});
  const red=new T.MeshPhysicalMaterial({color:0x1c1c1e,roughness:.28,clearcoat:1,clearcoatRoughness:.08});
  const faceMat=tex=>new T.MeshPhysicalMaterial({map:tex,roughness:.34,clearcoat:1,clearcoatRoughness:.14});
  const faces=[];for(let i=0;i<9;i++)faces.push(faceMat(face(1+(i*5)%6,1+(i*3+2)%6)));
  const stampFace=faceMat(face(4,4,{p1:'#b8604f',p2:'#7a2a1e',p3:'#4a1810'}));
  const claimFace=faceMat(face(6,6,{f1:'#2e2e30',f2:'#141415',p1:'#fffdf6',p2:'#d9d3c6',p3:'#a8a294'}));

  /* the run: a gentle S-curve on the floor */
  const N=44,dims=[];for(let i=0;i<N;i++)dims.push(i===N-1?{w:.85,h:1.7,t:.27}:{w:.5,h:1,t:.16});
  const pitch=i=>i===N-2?.54:.42;
  const curve=new T.CatmullRomCurve3([new T.Vector3(-10,0,4.2),new T.Vector3(-5.5,0,1.2),new T.Vector3(-1,0,-.8),new T.Vector3(3.5,0,-.2),new T.Vector3(8,0,-2.6),new T.Vector3(12,0,-3.4)]);
  const L=curve.getLength(),G=geo(.5,1,.16),GB=geo(.85,1.7,.27);
  const mirror=new T.Group();mirror.scale.y=-1;scene.add(mirror);
  const D=[];let d=0;
  for(let i=0;i<N;i++){
    const u=d/L,p=curve.getPointAt(u),tg=curve.getTangentAt(u),ry=Math.atan2(-tg.z,tg.x);
    const mk=(par,shadow)=>{const g=new T.Group();g.position.copy(p);g.rotation.y=ry;const r=new T.Group();g.add(r);
      const big=i===N-1,m=new T.Mesh(big?GB:G,[big?claimFace:i===0?stampFace:faces[i%faces.length],big?red:ivory]);
      m.castShadow=shadow;m.receiveShadow=shadow;r.add(m);par.add(g);return r;};
    D.push({r:mk(scene,true),mr:mk(mirror,false),p,tg,...dims[i],s:pitch(i),th:0,om:0,on:false});
    d+=pitch(i);
  }

  /* background: standing rows lost in the fog, dark mirrored pillars */
  const bgRow=(z,x0,n,rot)=>{for(let i=0;i<n;i++){const g=new T.Group();g.position.set(x0+i*.46,0,z);g.rotation.y=rot;const m=new T.Mesh(G,[faces[(i+3)%faces.length],ivory]);m.castShadow=true;g.add(m);scene.add(g);
    const mg=g.clone();mirror.add(mg);}};
  bgRow(-9.5,-16,70,Math.PI/2.4);bgRow(-15,-18,80,Math.PI/2.2);

  const floor=new T.Mesh(new T.PlaneGeometry(120,120),new T.MeshStandardMaterial({color:0x0b0c10,metalness:.88,roughness:.32,transparent:true,opacity:.8}));
  floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);

  scene.add(new T.AmbientLight(0xffffff,.12));
  const key=new T.DirectionalLight(0xfff4e6,2.4);key.position.set(-4,9,6);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-16,right:16,top:12,bottom:-12,near:1,far:40});key.shadow.bias=-.0004;key.shadow.radius=4;
  scene.add(key);
  const rim=new T.SpotLight(0xf2efe8,14,30,.45,.7);rim.position.set(6,7,-12);scene.add(rim);

  const cam=new T.PerspectiveCamera(30,W()/H(),.1,80);
  const cpos=new T.Vector3(),clook=new T.Vector3();
  function shot(f,pull){ /* frame the wavefront at index f; pull 0→1 lifts to the overview */
    const i=Math.max(0,Math.min(N-1,Math.floor(f))),j=Math.min(N-1,i+1),a=f-i;
    const p=D[i].p.clone().lerp(D[j].p,a),tg=D[i].tg.clone().lerp(D[j].tg,a).normalize(),side=new T.Vector3(-tg.z,0,tg.x);
    const near=p.clone().add(tg.clone().multiplyScalar(-1.5)).add(side.multiplyScalar(2.7));near.y=1.05;
    const look=p.clone().add(tg.clone().multiplyScalar(1.6));look.y=.35;
    const far=new T.Vector3(2,6.5,10.5),flook=new T.Vector3(1.5,0,-.6);
    return [near.lerp(far,pull),look.lerp(flook,pull)];
  }
  [cpos,clook].forEach((v,k)=>v.copy(shot(0,0)[k]));
  cam.position.copy(cpos);cam.lookAt(clook);

  let raf=0,run=false,t0=0,prev=0,wave=0,pull=0,pullTo=0,dead=false,landed=false;
  const g=24,TR=.88;
  function step(dt){
    for(let i=0;i<N;i++){const o=D[i];if(!o.on)continue;
      if(i+1<N&&D[i+1].on){const n=D[i+1],v=o.s*Math.cos(n.th)-n.t;if(v>=0)o.th=n.th+Math.asin(Math.min(1,v/o.h));continue;}
      if(i===N-1&&landed)continue;
      o.om+=1.5*g/o.h*Math.sin(o.th+.03)*dt;o.th+=o.om*dt;
      if(i+1<N){const n=D[i+1],c=Math.asin((o.s-n.t)/o.h);if(o.th>=c){o.th=c;n.on=true;n.om=o.om*o.h/n.h*TR;wave=i+1;hooks.hit&&hooks.hit(i+1,N);}}
      else if(o.th>=Math.PI/2){o.th=Math.PI/2;landed=true;hooks.land&&hooks.land();}
    }
  }
  let wv=0;
  function frame(ms){
    if(dead)return;raf=requestAnimationFrame(frame);
    const dt=Math.min(.1,(ms-(prev||ms))/1000);prev=ms;
    if(!hold)update(dt);R.render(scene,cam);
  }
  let hold=false;
  function update(dt){
    if(run){const n=Math.ceil(dt*240);for(let k=0;k<n;k++)step(dt/n);}
    D.forEach(o=>{o.r.rotation.z=-o.th;o.mr.rotation.z=-o.th;});
    wv+=(wave-wv)*Math.min(1,dt*3.2);pull+=(pullTo-pull)*Math.min(1,dt*.9);
    const [p,l]=shot(wv,pull*pull*(3-2*pull));cpos.lerp(p,Math.min(1,dt*2.6));clook.lerp(l,Math.min(1,dt*3.2));
    cam.position.copy(cpos);cam.lookAt(clook);
    
  }
  function resize(){R.setSize(W(),H(),false);cam.aspect=W()/H();cam.updateProjectionMatrix();}
  addEventListener('resize',resize);
  raf=requestAnimationFrame(frame);
  return {
    push(){D[0].on=true;D[0].om=1.5;run=true;hooks.hit&&hooks.hit(0,N);},
    overview(){pullTo=1;},
    sim(sec){hold=true;for(let k=0;k<sec*60;k++)update(1/60);R.render(scene,cam);},
    stop(){dead=true;cancelAnimationFrame(raf);removeEventListener('resize',resize);
      scene.traverse(o=>{if(o.geometry)o.geometry.dispose();});env.dispose();pm.dispose();R.dispose();}
  };
};
