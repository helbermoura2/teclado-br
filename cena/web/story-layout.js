// All coordinates are export pixels. Keep important content inside Instagram's UI margins.
const backgrounds=new WeakMap();
export const storyLayout={width:1080,height:1920,poster:{x:280,y:220,width:520,height:780},safe:{top:220,bottom:1660,left:100,right:980}};
export function parseStoryRating(value){
  const raw=String(value??'').trim();
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
function fitText(ctx,text,width,maxLines,start,min,font="sans-serif"){let size=start,lines;for(;size>=min;size-=2){ctx.font=`600 ${size}px ${font}`;lines=wrapStoryText(ctx,text,width,100);if(lines.length<=maxLines)break;}size=Math.max(min,size);ctx.font=`600 ${size}px ${font}`;return {size,lines:wrapStoryText(ctx,text,width,maxLines)};}
export function renderStory(canvas,{image=null,title='',originalTitle='',year='',type='movie',caption='',rating='',brandMark=null,brandWordmark=null,template='editorial',availability=[]}={}){
  const ctx=canvas.getContext('2d');canvas.width=1080;canvas.height=1920;
  const guide=template==='guide';
  const cached=backgrounds.get(canvas);
  if(cached&&cached.image===image&&cached.template===template&&typeof ctx.putImageData==='function')ctx.putImageData(cached.pixels,0,0);
  else {
  ctx.fillStyle='#100e1c';ctx.fillRect(0,0,1080,1920);
  if(image){ctx.save();ctx.filter=guide?'blur(10px)':'blur(32px)';cover(ctx,image,-120,-120,1320,2160);ctx.restore();}
  ctx.fillStyle='rgba(8,10,18,.70)';ctx.fillRect(0,0,1080,1920);
  const tint=ctx.createLinearGradient(0,0,1080,1920);tint.addColorStop(0,'rgba(145,66,210,.25)');tint.addColorStop(.5,'rgba(28,21,50,.08)');tint.addColorStop(1,'rgba(109,55,164,.30)');ctx.fillStyle=tint;ctx.fillRect(0,0,1080,1920);
  if(typeof ctx.getImageData==='function')backgrounds.set(canvas,{image,template,pixels:ctx.getImageData(0,0,1080,1920)});
  }
  const p=guide?{x:356,y:232,width:368,height:552}:{x:306,y:222,width:468,height:702};
  ctx.save();ctx.shadowColor='rgba(0,0,0,.60)';ctx.shadowBlur=38;ctx.shadowOffsetY=16;
  ctx.fillStyle='#211d2d';ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,20);ctx.fill();ctx.restore();
  if(image){ctx.save();ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,20);ctx.clip();cover(ctx,image,p.x,p.y,p.width,p.height);ctx.restore();}
  const center=540;
  ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle='#f7f0ff';
  const heading=fitText(ctx,title,880,2,guide?76:68,39,guide?'sans-serif-condensed, sans-serif':'Georgia, serif');
  const titleTop=p.y+p.height+40;
  heading.lines.forEach((line,i)=>ctx.fillText(line,center,titleTop+i*(heading.size+8)));
  let cursor=titleTop+heading.lines.length*(heading.size+8)+14;
  ctx.font='500 27px sans-serif';ctx.fillStyle='#d6c8ea';
  const details=[String(year).match(/\d{4}/)?.[0],type==='series'?'Série':'Filme'];
  const review=storyOpinion(caption,rating);
  if(review.score!==null)details.push(`${String(review.score).replace('.',',')} / 10`);
  ctx.fillText(details.filter(Boolean).join(' · '),center,cursor);cursor+=43;
  if(!availability.length&&originalTitle&&originalTitle.toLocaleLowerCase()!==title.toLocaleLowerCase()&&cursor<1190){
    ctx.font='25px sans-serif';ctx.fillText(wrapStoryText(ctx,originalTitle,830,1)[0]||'',center,cursor);cursor+=36;
  }
  const sources=availability.slice(0,3);
  const opinion=fitText(ctx,review.opinion,850,sources.length?2:3,38,29,'Georgia, serif');
  ctx.fillStyle='#fff';const opinionTop=cursor+5;
  opinion.lines.forEach((line,i)=>ctx.fillText(line,center,opinionTop+i*(opinion.size+9)));
  const opinionBottom=opinionTop+opinion.lines.length*(opinion.size+9);
  if(sources.length){
    const top=Math.max(guide?1100:1260,opinionBottom+14);
    ctx.textAlign='left';ctx.fillStyle='rgba(173,116,255,.15)';ctx.beginPath();
    ctx.roundRect(117,top,846,53+sources.length*39,19);ctx.fill();
    ctx.fillStyle='#dcc3ff';ctx.font='700 20px sans-serif';ctx.fillText('ONDE ASSISTIR NO BRASIL',139,top+11);
    ctx.font='32px sans-serif';ctx.fillStyle='#fff';
    sources.forEach((row,i)=>ctx.fillText(wrapStoryText(ctx,row,799,1)[0]||'',139,top+40+i*39));
    ctx.textAlign='center';ctx.font='16px sans-serif';ctx.fillStyle='#d6c8ea';
    ctx.fillText('Fontes: TMDB / JustWatch',center,top+58+sources.length*39);
  }
  if(brandMark&&brandWordmark){ctx.drawImage(brandMark,365,1560,83,83);ctx.drawImage(brandWordmark,450,1584,265,45);}
  else{ctx.textAlign='center';ctx.fillStyle='#eee9f6';ctx.font='600 39px sans-serif';ctx.fillText('CENA IA',center,1584);}
  canvas.dataset.storyTitle=title;canvas.dataset.storyRating=review.score===null?'':String(review.score);canvas.dataset.storyOpinion=review.opinion;canvas.dataset.layoutVersion='3';canvas.dataset.storyTemplate=template;
  return {titleLines:heading.lines,opinionLines:opinion.lines,opinionBottom,score:review.score};
}
