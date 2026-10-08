import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile} from 'file:///C:/Users/Davi%20Cuevas/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const root='C:/Users/Davi Cuevas/gt barbearia site';
const build=path.join(root,'tmp/anuncio-editavel');
const out=path.join(root,'output/anuncio');
const skill='C:/Users/Davi Cuevas/.codex/plugins/cache/openai-primary-runtime/presentations/26.1007.11041/skills/presentations';
const p=Presentation.create({slideSize:{width:1489,height:1900}});
const s=p.slides.add();s.background.fill='#080808';
function shape(name,x,y,w,h,fill,line='none',lw=0,r=0){return s.shapes.add({name,geometry:r?'roundRect':'rect',position:{left:x,top:y,width:w,height:h},fill,line:{style:'solid',fill:line,width:lw},...(r?{borderRadius:r}:{})});}
shape('Fundo preto',0,0,1489,1900,'#080808');

const logo=await fs.readFile(path.join(root,'favicon.svg'),'utf8');
const d=logo.match(/ d="([^"]+)"/)[1];
const tok=d.match(/[MCLZ]|-?\d*\.?\d+/g);let i=0,cmd,commands=[];
while(i<tok.length){cmd=tok[i++];if(cmd==='M'){commands.push({moveTo:{x:+tok[i++],y:+tok[i++]}});}else if(cmd==='L'){commands.push({lineTo:{x:+tok[i++],y:+tok[i++]}});}else if(cmd==='C'){commands.push({cubicBezTo:{x1:+tok[i++],y1:+tok[i++],x2:+tok[i++],y2:+tok[i++],x:+tok[i++],y:+tok[i++]}});}else if(cmd==='Z'){commands.push({close:{}});}else throw new Error('Unsupported SVG path '+cmd);}
s.shapes.add({name:'Logo GT vetorial',geometry:'custom',position:{left:40,top:50,width:118,height:118},fill:'#FF6A00',line:{fill:'none',width:0},customPaths:[{width:64,height:64,commands}]});
const title=shape('Titulo NOSSO SITE',185,220,1119,290,'none');title.text='NOSSO SITE';title.text.style={typeface:'Impact',fontSize:235,color:'#FF6A00',alignment:'center',verticalAlignment:'middle',wrap:'none'};title.text.insets=0;
shape('Moldura do site',51,551,1387,685,'#0C0C0C','#555555',1.4,5);
const bytes=await fs.readFile(path.join(out,'site-central-original.png'));
s.images.add({name:'Print original preservado',blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/png',alt:'Print original do site GT Barbearia preservado, sem modificar rostos ou textos',fit:'contain',position:{left:53,top:553,width:1383,height:681}});
shape('Sombra do card',199,1403,1091,200,'#000000/22','none',0,59);
shape('Borda de vidro',206,1390,1077,198,'linear(115deg, #A2A2A2 0%, #414141 30%, #858585 69%, #B7B7B7 100%)','none',0,55);
shape('Superficie de vidro',208,1392,1073,194,'linear(90deg, #242424 0%, #131313 40%, #151515 65%, #303030 100%)','none',0,53);
shape('Brilho superior suave',233,1394,1023,57,'linear(90deg, #FFFFFF/5 0%, #FFFFFF/0 100%)','none',0,27);
shape('Reflexo inferior suave',238,1525,1013,57,'linear(90deg, #FFFFFF/0 0%, #FFFFFF/3 100%)','none',0,28);
const url=shape('URL editavel',255,1440,979,100,'none');url.text='www.gtbarbearia16.com.br';url.text.style={typeface:'Arial',fontSize:57,color:'#F7F7F7',bold:true,alignment:'center',verticalAlignment:'middle',wrap:'none'};url.text.insets=0;
await fs.writeFile(path.join(build,'preview.png'),new Uint8Array(await (await p.export({slide:s,format:'png',scale:1})).arrayBuffer()));
await fs.writeFile(path.join(build,'layout.json'),await (await s.export({format:'layout'})).text());
const candidate=path.join(build,'candidate.pptx');await (await PresentationFile.exportPptx(p)).save(candidate);
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(out,'gt-anuncio-profissional-editavel-final.pptx'),pythonExecutable:'C:/Users/Davi Cuevas/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','14182725,18097500'],explicitTotalSlideCount:1,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:['Arial','Impact']},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation-final.json')});
console.log(JSON.stringify({finalPath:result.finalPath,valid:true}));


