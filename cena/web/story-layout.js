// All coordinates are export pixels. Keep important content inside Instagram's UI margins.
const backgrounds=new WeakMap();
export const storyLayout={width:1080,height:1920,poster:{x:280,y:242,width:520,height:780},safe:{top:220,bottom:1660,left:100,right:980}};
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
  const p=guide?{x:336,y:245,width:408,height:612}:storyLayout.poster;
  const {left,right}=storyLayout.safe;
  ctx.fillStyle='#bd96e8';
  ctx.fillRect(left,p.y+24,100,2);ctx.fillRect(right-100,p.y+24,100,2);
  ctx.fillRect(left,p.y+46,52,2);ctx.fillRect(right-52,p.y+46,52,2);
  ctx.save();ctx.shadowColor='rgba(0,0,0,.60)';ctx.shadowBlur=38;ctx.shadowOffsetY=16;
  ctx.fillStyle='#211d2d';ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,20);ctx.fill();ctx.restore();
  if(image){ctx.save();ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,20);ctx.clip();cover(ctx,image,p.x,p.y,p.width,p.height);ctx.restore();}
  ctx.strokeStyle='#b89acf8c';ctx.lineWidth=2;ctx.beginPath();
  ctx.roundRect(p.x,p.y,p.width,p.height,20);ctx.stroke();
  const center=540;
  ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle='#f7f0ff';
  const heading=fitText(ctx,title,880,2,guide?76:65,39,guide?'sans-serif-condensed, sans-serif':"\"Playfair Display\", Georgia, serif");
  const titleTop=p.y+p.height+23;
  heading.lines.forEach((line,i)=>ctx.fillText(line,center,titleTop+i*(heading.size+8)));
  let cursor=titleTop+heading.lines.length*(heading.size+8)+9;
  ctx.font='500 27px sans-serif';ctx.fillStyle='#d6c8ea';
  const details=[String(year).match(/\d{4}/)?.[0],type==='series'?'Série':'Filme'];
  const review=storyOpinion(caption,rating);
  if(review.score!==null)details.push(`${String(review.score).replace('.',',')} / 10`);
  ctx.fillText(details.filter(Boolean).join(' · '),center,cursor);cursor+=36;
  if(!availability.length&&originalTitle&&originalTitle.toLocaleLowerCase()!==title.toLocaleLowerCase()&&cursor<1190){
    ctx.font='25px sans-serif';ctx.fillText(wrapStoryText(ctx,originalTitle,830,1)[0]||'',center,cursor);cursor+=36;
  }
  const sources=availability.slice(0,3);
  const opinion=fitText(ctx,review.opinion,850,sources.length?2:3,34,27,"\"Playfair Display\", Georgia, serif");
  ctx.fillStyle='#fff';const opinionTop=cursor+5;
  opinion.lines.forEach((line,i)=>ctx.fillText(line,center,opinionTop+i*(opinion.size+9)));
  const opinionBottom=opinionTop+opinion.lines.length*(opinion.size+9);
  if(sources.length){
    const top=Math.max(guide?1060:1190,opinionBottom+18);
    const x=left,width=right-left,contentX=x+24, labelWidth=190;
    const rowHeight=sources.length===1?70:40;
    const height=55+sources.length*rowHeight;
    ctx.textAlign='left';ctx.fillStyle='#241831';ctx.beginPath();
    ctx.roundRect(x,top,width,height,18);ctx.fill();
    ctx.fillStyle='#bd96e8';ctx.fillRect(contentX,top+43,width-48,1);
    ctx.font='700 20px sans-serif';ctx.fillText('ONDE ASSISTIR NO BRASIL',contentX,top+14);
    sources.forEach((row,i)=>{
      const separator=row.indexOf(' · ');
      const label=separator<0?'':row.slice(0,separator);
      const names=separator<0?row:row.slice(separator+3);
      const y=top+53+i*rowHeight;
      if(label){ctx.font='700 22px sans-serif';ctx.fillStyle='#e1c3fc';ctx.fillText(label,contentX,y+3);}
      ctx.font='600 26px sans-serif';ctx.fillStyle='#fff';
      const namesX=contentX+(label?labelWidth:0);
      wrapStoryText(ctx,names,x+width-24-namesX,sources.length===1?2:1)
        .forEach((line,index)=>ctx.fillText(line,namesX,y+index*29));
    });
    ctx.textAlign='center';ctx.font='500 18px sans-serif';ctx.fillStyle='#e5d4f6';
    ctx.fillText('Fontes: TMDB / JustWatch',center,top+height+9);
  }
  if(brandMark&&brandWordmark){ctx.drawImage(brandMark,365,1560,83,83);ctx.drawImage(brandWordmark,450,1584,265,45);}
  else{ctx.textAlign='center';ctx.fillStyle='#eee9f6';ctx.font='600 39px sans-serif';ctx.fillText('CENA IA',center,1584);}
  canvas.dataset.storyTitle=title;canvas.dataset.storyRating=review.score===null?'':String(review.score);canvas.dataset.storyOpinion=review.opinion;canvas.dataset.layoutVersion='4';canvas.dataset.storyTemplate=template;
  return {titleLines:heading.lines,opinionLines:opinion.lines,opinionBottom,score:review.score};
}
