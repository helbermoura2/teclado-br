// All coordinates are export pixels. Keep important content inside Instagram's UI margins.
const backgrounds=new WeakMap();
export const storyLayout={width:1080,height:1920,poster:{x:100,y:350,width:484,height:726},safe:{top:220,bottom:1660,left:100,right:980}};
export function parseStoryRating(value){
  const raw=String(value??'').trim().replace(/\s*([.,])\s*/g,'$1');
  if(!/^\d{1,2}([.,]\d{1,2})?$/.test(raw))return null;
  const score=Number(raw.replace(',','.'));return Number.isFinite(score)&&score>=0&&score<=10?score:null;
}
export function storyOpinion(text,rating=''){
  let opinion=String(text||'').trim();
  const suffix=opinion.match(/(?:[,;—–-]?\s*)(?<![\d.,])(10|[0-9])(?:[.,]([0-9]{1,2}))?\s*\/\s*10[.!]?\s*$/);
  const raw=String(rating??'').trim().replace(',','.');
  const explicit=parseStoryRating(raw);
  const embedded=suffix?Number(suffix[1]+'.'+(suffix[2]||'0')):NaN;
  const score=explicit!==null?explicit:raw===''&&embedded>=0&&embedded<=10?embedded:null;
  if(suffix&&score!==null)opinion=opinion.slice(0,suffix.index).trim().replace(/[,;—–-]$/,'').trim();
  return {opinion,score};
}
export function wrapStoryText(ctx,text,width,maxLines){
  const tokens=String(text||'').trim().split(/\s+/).filter(Boolean),lines=[];let line='';
  for(const word of tokens){
    if(ctx.measureText(word).width>width){
      if(line){lines.push(line);line='';}
      for(const character of Array.from(word)){if(ctx.measureText(line+character).width>width&&line){lines.push(line);line='';}line+=character;}
    }else if(ctx.measureText(line?line+' '+word:word).width<=width)line=line?line+' '+word:word;
    else{lines.push(line);line=word;}
  }
  if(line)lines.push(line);
  if(lines.length>maxLines){lines.length=maxLines;let last=lines[maxLines-1];while(last&&ctx.measureText(last+'…').width>width)last=Array.from(last).slice(0,-1).join('');lines[maxLines-1]=last.trimEnd()+'…';}
  return lines;
}
function cover(ctx,image,x,y,width,height){const scale=Math.max(width/image.width,height/image.height),w=image.width*scale,h=image.height*scale;ctx.drawImage(image,x+(width-w)/2,y+(height-h)/2,w,h);}
function fitText(ctx,text,width,maxLines,start,min,font="sans-serif",weight=600){let size=start,lines;for(;size>=min;size-=2){ctx.font=`${weight} ${size}px ${font}`;lines=wrapStoryText(ctx,text,width,100);if(lines.length<=maxLines)break;}size=Math.max(min,size);ctx.font=`${weight} ${size}px ${font}`;return {size,lines:wrapStoryText(ctx,text,width,maxLines)};}
export function renderStory(canvas,{image=null,title='',originalTitle='',year='',type='movie',caption='',rating='',brandMark=null,brandWordmark=null,availability=[]}={}){
  const ctx=canvas.getContext('2d');canvas.width=1080;canvas.height=1920;
  const cached=backgrounds.get(canvas);
  if(cached&&cached.image===image&&typeof ctx.putImageData==='function')ctx.putImageData(cached.pixels,0,0);
  else {
  ctx.fillStyle='#100e1c';ctx.fillRect(0,0,1080,1920);
  if(image){ctx.save();ctx.filter='blur(38px)';cover(ctx,image,-120,-120,1320,2160);ctx.restore();}
  ctx.fillStyle='rgba(8,10,18,.70)';ctx.fillRect(0,0,1080,1920);
  const tint=ctx.createLinearGradient(0,0,1080,1920);tint.addColorStop(0,'rgba(145,66,210,.25)');tint.addColorStop(.5,'rgba(28,21,50,.08)');tint.addColorStop(1,'rgba(109,55,164,.30)');ctx.fillStyle=tint;ctx.fillRect(0,0,1080,1920);
  if(typeof ctx.getImageData==='function')backgrounds.set(canvas,{image,pixels:ctx.getImageData(0,0,1080,1920)});
  }
  const {left,right,top}=storyLayout.safe;
  const width=right-left;
  const p=storyLayout.poster;
  const sans='Manrope, sans-serif';
  if(brandMark){
    ctx.save();
    ctx.globalAlpha=.075;
    ctx.drawImage(brandMark,270,245,820,820);
    ctx.restore();
  }
  if(brandMark&&brandWordmark){
    ctx.drawImage(brandMark,left-14,top-12,128,128);
    ctx.drawImage(brandWordmark,left+118,top+20,380,64);
  }else{
    ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillStyle='#eee9f6';ctx.font=`800 42px ${sans}`;
    ctx.fillText('CENA IA',left,top+20);
  }
  if(image){
    ctx.save();
    ctx.shadowColor='#0009';ctx.shadowBlur=34;ctx.shadowOffsetY=16;
    ctx.fillStyle='#211d2d';ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,15);
    ctx.fill();ctx.restore();
    ctx.save();ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,15);ctx.clip();
    const scale=Math.min(p.width/image.width,p.height/image.height);
    const w=image.width*scale,h=image.height*scale;
    ctx.drawImage(image,p.x+(p.width-w)/2,p.y+(p.height-h)/2,w,h);
    ctx.restore();
  }
  const anchor=left;
  ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillStyle='#f7f0ff';
  const sidebar=Boolean(image);
  const titleX=sidebar?p.x+p.width+30:anchor;
  const titleWidth=sidebar?right-titleX:width;
  const colon=title.indexOf(': ');
  const heading=fitText(ctx,title,titleWidth,sidebar?4:2,sidebar?64:76,sidebar?36:38,sans,800);
  const mainTitle=colon>0?title.slice(0,colon):'';
  const subtitle=colon>0?title.slice(colon+2):'';
  const subtitleSize=Math.round(heading.size*.79);
  const mainLines=wrapStoryText(ctx,mainTitle,titleWidth,10);
  ctx.font=`650 ${subtitleSize}px ${sans}`;
  const subLines=wrapStoryText(ctx,subtitle,titleWidth,10);
  const splitTitle=mainTitle&&subtitle&&mainLines.length+subLines.length<=(sidebar?4:2);
  const titleLines=splitTitle?[...mainLines,...subLines]:heading.lines;
  const titleTop=sidebar?p.y+Math.max(38,(p.height-titleLines.length*(heading.size+8)-50)/2):
    690;
  let cursor=titleTop;
  titleLines.forEach((line,i)=>{
    const subtitleLine=splitTitle&&i>=mainLines.length;
    const size=subtitleLine?subtitleSize:heading.size;
    ctx.font=`${subtitleLine?650:800} ${size}px ${sans}`;
    ctx.fillStyle=subtitleLine?'#e7d8ed':'#f7f0ff';
    ctx.fillText(line,titleX,cursor);
    cursor+=size+8;
  });
  cursor+=13;
  ctx.font=`700 29px ${sans}`;ctx.fillStyle='#d6c8ea';
  const details=[String(year).match(/\d{4}/)?.[0],type==='series'?'Série':'Filme'].filter(Boolean).join(' · ');
  const review=storyOpinion(caption,rating);
  ctx.fillText(details,titleX,cursor);
  cursor=sidebar?p.y+p.height+28:cursor+38;
  if(!availability.length&&originalTitle&&originalTitle.toLocaleLowerCase()!==title.toLocaleLowerCase()&&cursor<1250){
    ctx.font=`500 24px ${sans}`;ctx.fillStyle='#d6c8ea';
    ctx.fillText(wrapStoryText(ctx,originalTitle,width,1)[0]||'',anchor,cursor);cursor+=34;
  }
  const sources=availability.slice(0,3);
  if(review.score!==null){
    ctx.font=`800 42px ${sans}`;ctx.fillStyle='#ead3ff';
    ctx.fillText(`${String(review.score).replace('.',',')} / 10`,anchor,cursor+5);
    cursor+=48;
  }
  const opinion=fitText(ctx,review.opinion,width,3,39,29,sans,400);
  ctx.font=`400 ${opinion.size}px ${sans}`;
  ctx.fillStyle='#f6edf9';const opinionTop=cursor+11;
  opinion.lines.forEach((line,i)=>ctx.fillText(line,anchor,opinionTop+i*(opinion.size+9)));
  const opinionBottom=opinionTop+opinion.lines.length*(opinion.size+9);
  if(sources.length){
    const ruleY=Math.max(opinionBottom+20,sidebar?1295:1030);
    ctx.textAlign='left';
    ctx.fillStyle='#ab91c2';ctx.fillRect(left,ruleY,width,1);
    ctx.fillStyle='#ddc9ed';ctx.font=`700 27px ${sans}`;
    ctx.beginPath();
    ctx.moveTo(left,ruleY+20);ctx.lineTo(left+19,ruleY+31);ctx.lineTo(left,ruleY+42);ctx.closePath();ctx.fill();
    ctx.fillText('ONDE ASSISTIR NO BRASIL',left+32,ruleY+16);
    let y=ruleY+54;
    for(const row of sources){
      const separator=row.indexOf(' · ');
      const label=separator<0?'':row.slice(0,separator);
      const providers=(separator<0?row:row.slice(separator+3)).split(', ');
      const netflixAds=providers.findIndex(name=>/^Netflix (Standard with Ads|com anúncios)$/i.test(name));
      const hasBoth=netflixAds>=0&&providers.some(name=>/^Netflix$/i.test(name));
      if(hasBoth)providers.splice(netflixAds,1);
      else if(netflixAds>=0)providers[netflixAds]='Netflix com anúncios';
      ctx.font=`600 25px ${sans}`;
      const labelText=label?`${label} · `:'';
      const indent=label?ctx.measureText(labelText).width+5:0;
      ctx.fillStyle='#d3bbdf';
      if(label)ctx.fillText(labelText,left,y+3);
      ctx.font=`700 32px ${sans}`;ctx.fillStyle='#fff';
      const lines=wrapStoryText(ctx,providers.join(', '),width-indent,sources.length===1?2:1);
      lines.forEach((line,index)=>ctx.fillText(line,left+indent,y+index*34));
      y+=Math.max(37,lines.length*34+7);
      if(hasBoth){
        ctx.font=`500 23px ${sans}`;ctx.fillStyle='#d3bbdf';
        ctx.fillText('Também no plano com anúncios',left+indent,y-3);
        y+=24;
      }
    }
    ctx.font=`500 20px ${sans}`;ctx.fillStyle='#c9b6d8';
    ctx.fillText('TMDB / JustWatch',left,y+6);
  }
  canvas.dataset.storyTitle=title;canvas.dataset.storyRating=review.score===null?'':String(review.score);canvas.dataset.storyOpinion=review.opinion;canvas.dataset.layoutVersion='9';
  return {titleLines,opinionLines:opinion.lines,opinionBottom,score:review.score};
}
