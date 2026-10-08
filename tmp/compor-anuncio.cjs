const sharp = require('C:/Users/Davi Cuevas/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const fs = require('node:fs/promises');
(async()=>{
 const dir='C:/Users/Davi Cuevas/gt barbearia site/output/anuncio/';
 const generated='C:/Users/Davi Cuevas/.codex/generated_images/01a11c24-13ee-72a3-9357-38f5e5bef2ed/exec-e25666f8-7d0e-45b1-870b-07be5ae90a30.png';
 const bg=await sharp(generated).resize(1489,1861,{fit:'fill'}).png().toBuffer();
 const top=await sharp(bg).extract({left:0,top:0,width:1489,height:551}).png().toBuffer();
 const center=await sharp(bg).extract({left:0,top:551,width:1489,height:646}).resize(1489,685,{fit:'fill'}).png().toBuffer();
 const bottom=await sharp(bg).extract({left:0,top:1197,width:1489,height:664}).png().toBuffer();
 const background=await sharp({create:{width:1489,height:1900,channels:3,background:'#080808'}}).composite([{input:top,left:0,top:0},{input:center,left:0,top:551},{input:bottom,left:0,top:1236}]).png().toBuffer();
 const output=dir+'gt-anuncio-profissional-site-preservado.png';
 await sharp(background).composite([{input:dir+'site-central-original.png',left:53,top:553}]).png().toFile(output);
 const original=await sharp(dir+'site-central-original.png').removeAlpha().raw().toBuffer();
 const actual=await sharp(output).extract({left:53,top:553,width:1383,height:681}).removeAlpha().raw().toBuffer();
 const identical=original.equals(actual);
 if(!identical) throw new Error('Original screenshot pixels differ');
 await fs.writeFile(dir+'gt-anuncio-profissional-verificacao.json',JSON.stringify({source:'C:/Users/Davi Cuevas/Downloads/Urbelândia  MG (1).png',sourceRegion:{left:80,top:534,width:1383,height:681},finalRegion:{left:53,top:553,width:1383,height:681},identicalPixels:identical,width:1489,height:1900},null,2));
 console.log(JSON.stringify({output,screenshotPixelsIdentical:identical,width:1489,height:1900}));
})();
