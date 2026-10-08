import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation, PresentationFile} from 'file:///C:/Users/Davi%20Cuevas/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const root='C:/Users/Davi Cuevas/gt barbearia site';
const build=path.join(root,'tmp/liquid-glass');
const out=path.join(root,'output/liquid-glass');
const skill='C:/Users/Davi Cuevas/.codex/plugins/cache/openai-primary-runtime/presentations/26.1007.11041/skills/presentations';
const p=Presentation.create({slideSize:{width:1600,height:900}});
const s=p.slides.add();s.background.fill='#FFFFFF';
function shape(name,x,y,w,h,fill,line='none',lw=0,r=0){return s.shapes.add({name,geometry:r?'roundRect':'rect',position:{left:x,top:y,width:w,height:h},fill,line:{style:'solid',fill:line,width:lw},...(r?{borderRadius:r}:{})});}
// All optical layers are native, individually editable vector shapes.
for(let i=6;i>=1;i--){shape('Sombra suave '+i,300-i*4,324-i*2,1000+i*8,252+i*5,'#26384B/'+(1.2+i*.16),'none',0,126+i*3);}
shape('Contorno externo do vidro',300,300,1000,280,'linear(135deg, #FFFFFF 0%, #DFE3E8 26%, #C1C7CF 48%, #FAFBFC 73%, #FFFFFF 100%)','none',0,140);
shape('Corpo translúcido',302,302,996,276,'linear(110deg, #F5F7F9/83 0%, #E6E9ED/67 40%, #F4F6F8/71 70%, #FCFDFE/89 100%)','#FFFFFF/85',1,138);
shape('Profundidade interior',308,308,984,264,'linear(90deg, #FFFFFF/58 0%, #FFFFFF/7 29%, #BDCAD8/7 65%, #9AA7B5/11 100%)','none',0,132);
function ribbon(name,x,y,w,h,alpha){return s.shapes.add({name,geometry:'custom',position:{left:x,top:y,width:w,height:h},fill:'linear(0deg, #FFFFFF/0 0%, #FFFFFF/'+alpha+' 45%, #FFFFFF/0 100%)',line:{fill:'none',width:0},customPaths:[{width:w,height:h,commands:[{moveTo:{x:0,y:h}},{lineTo:{x:w*.65,y:0}},{lineTo:{x:w,y:0}},{lineTo:{x:w*.35,y:h}},{close:{}}]}]});}
ribbon('Reflexo diagonal largo',708,316,244,248,38);
ribbon('Reflexo diagonal fino',932,316,72,248,27);
// Highlight and refraction are separate native paths, not raster effects.
function curve(name,x,y,w,h,color,lw,commands){return s.shapes.add({name,geometry:'custom',position:{left:x,top:y,width:w,height:h},fill:'none',line:{style:'solid',fill:color,width:lw},customPaths:[{width:w,height:h,commands}]});}
curve('Brilho superior esquerdo',302,302,590,180,'#FFFFFF/98',3.2,[{moveTo:{x:1,y:175}},{cubicBezTo:{x1:-6,y1:69,x2:48,y2:0,x:137,y:0}},{lineTo:{x:590,y:0}}]);
curve('Brilho inferior direito',721,424,577,154,'#FFFFFF/95',3.2,[{moveTo:{x:0,y:154}},{lineTo:{x:438,y:154}},{cubicBezTo:{x1:534,y1:154,x2:577,y2:99,x:577,y:0}}]);
curve('Refracao inferior',432,575,733,2,'#B3BCC7/40',.8,[{moveTo:{x:0,y:0}},{lineTo:{x:733,y:0}}]);
const t=shape('Texto editável',460,394,680,92,'none');t.text='Liquid Glass';t.text.style={typeface:'Arial',fontSize:72,color:'#333C46',alignment:'center',verticalAlignment:'middle',bold:false};t.text.insets=0;
await fs.writeFile(path.join(build,'preview.png'),new Uint8Array(await (await p.export({slide:s,format:'png',scale:1})).arrayBuffer()));
await fs.writeFile(path.join(build,'layout.json'),await (await s.export({format:'layout'})).text());
const candidate=path.join(build,'candidate.pptx');await (await PresentationFile.exportPptx(p)).save(candidate);
const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools/artifact_tool_utils.mjs')).href);
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(out,'liquid-glass-branco-editavel.pptx'),pythonExecutable:'C:/Users/Davi Cuevas/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','15240000,8572500'],explicitTotalSlideCount:1,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
console.log(JSON.stringify(result));

