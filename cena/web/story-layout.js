// All coordinates are export pixels. Keep important content inside Instagram's UI margins.
const backgrounds=new WeakMap();
export const storyLayout={width:1080,height:1920,poster:{x:100,y:320,width:464,height:696},safe:{top:220,bottom:1660,left:100,right:980}};
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
  const {left,right,top}=storyLayout.safe;
  const width=right-left,center=540;
  const p=guide?{x:336,y:324,width:408,height:612}:storyLayout.poster;
  const serif='"Playfair Display", Georgia, serif';
  if(brandMark){
    ctx.save();
    ctx.globalAlpha=guide?.17:.31;
    ctx.drawImage(brandMark,guide?225:385,190,guide?640:820,guide?640:820);
    ctx.restore();
  }
  const brandX=guide?404:left;
  if(brandMark&&brandWordmark){
    ctx.drawImage(brandMark,brandX,top,64,64);
    ctx.drawImage(brandWordmark,brandX+75,top+17,195,33);
  }else{
    ctx.textAlign=guide?'center':'left';ctx.textBaseline='top';
    ctx.fillStyle='#eee9f6';ctx.font='600 30px sans-serif';
    ctx.fillText('CENA IA',guide?center:left,top+16);
  }
  if(image){
    ctx.save();
    ctx.shadowColor='#0009';ctx.shadowBlur=34;ctx.shadowOffsetY=16;
    ctx.fillStyle='#211d2d';ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,15);
    ctx.fill();ctx.restore();
    ctx.save();ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,15);ctx.clip();
    cover(ctx,image,p.x,p.y,p.width,p.height);ctx.restore();
  }
  const anchor=guide?center:left;
  ctx.textAlign=guide?'center':'left';ctx.textBaseline='top';
  ctx.fillStyle='#f7f0ff';
  const titleTop=image?p.y+p.height+32:guide?690:840;
  const colon=title.indexOf(': ');
  const heading=fitText(ctx,title,width,2,guide?69:64,39,serif);
  const mainTitle=colon>0?title.slice(0,colon):'';
  const subtitle=colon>0?title.slice(colon+2):'';
  const splitTitle=mainTitle&&subtitle
    &&ctx.measureText(mainTitle).width<=width&&ctx.measureText(subtitle).width<=width;
  const titleLines=splitTitle?[mainTitle,subtitle]:heading.lines;
  titleLines.forEach((line,i)=>{
    const subtitleLine=splitTitle&&i===1;
    ctx.font=`600 ${subtitleLine?Math.round(heading.size*.79):heading.size}px ${serif}`;
    ctx.fillStyle=subtitleLine?'#e7d8ed':'#f7f0ff';
    ctx.fillText(line,anchor,titleTop+i*(heading.size+5));
  });
  let cursor=titleTop+(titleLines.length-1)*(heading.size+5)+(splitTitle?Math.round(heading.size*.79):heading.size)+18;
  ctx.font='600 24px sans-serif';ctx.fillStyle='#d6c8ea';
  const details=[String(year).match(/\d{4}/)?.[0],type==='series'?'Série':'Filme'].filter(Boolean).join(' · ');
  const review=storyOpinion(caption,rating);
  ctx.fillText(details,anchor,cursor);
  if(review.score!==null){
    const score=`${String(review.score).replace('.',',')} / 10`;
    if(!guide){
      ctx.textAlign='right';
      ctx.font='700 27px sans-serif';ctx.fillStyle='#ead3ff';
      ctx.fillText(score,right,cursor-2);
      ctx.textAlign='left';
    }else{
      ctx.font='700 25px sans-serif';ctx.fillStyle='#ead3ff';
      ctx.fillText(score,anchor,cursor+31);cursor+=31;
    }
  }
  cursor+=37;
  if(!availability.length&&originalTitle&&originalTitle.toLocaleLowerCase()!==title.toLocaleLowerCase()&&cursor<1250){
    ctx.font='24px sans-serif';ctx.fillStyle='#d6c8ea';
    ctx.fillText(wrapStoryText(ctx,originalTitle,width,1)[0]||'',anchor,cursor);cursor+=34;
  }
  const sources=availability.slice(0,3);
  const opinion=fitText(ctx,review.opinion,width,3,31,26);
  ctx.font=`400 ${opinion.size}px sans-serif`;
  ctx.fillStyle='#f6edf9';const opinionTop=cursor+11;
  opinion.lines.forEach((line,i)=>ctx.fillText(line,anchor,opinionTop+i*(opinion.size+9)));
  const opinionBottom=opinionTop+opinion.lines.length*(opinion.size+9);
  if(sources.length){
    const ruleY=opinionBottom+25;
    ctx.textAlign='left';
    ctx.fillStyle='#ab91c2';ctx.fillRect(left,ruleY,width,1);
    ctx.fillStyle='#ddc9ed';ctx.font='700 19px sans-serif';
    ctx.fillText('ONDE ASSISTIR NO BRASIL',left,ruleY+16);
    let y=ruleY+48;
    for(const row of sources){
      const separator=row.indexOf(' · ');
      const label=separator<0?'':row.slice(0,separator);
      const names=separator<0?row:row.slice(separator+3)
        .replace(/(^|, )Netflix Standard with Ads(?=, |$)/gi,'$1Netflix com anúncios');
      ctx.font='600 21px sans-serif';
      const labelText=label?`${label} · `:'';
      const indent=ctx.measureText(labelText).width+5;
      ctx.fillStyle='#d3bbdf';
      if(label)ctx.fillText(labelText,left,y+3);
      ctx.font='600 25px sans-serif';ctx.fillStyle='#fff';
      const lines=wrapStoryText(ctx,names,width-indent,sources.length===1?2:1);
      lines.forEach((line,index)=>ctx.fillText(line,left+indent,y+index*29));
      y+=Math.max(35,lines.length*29+7);
    }
    ctx.font='500 18px sans-serif';ctx.fillStyle='#c9b6d8';
    ctx.fillText('TMDB / JustWatch',left,y+6);
  }
  canvas.dataset.storyTitle=title;canvas.dataset.storyRating=review.score===null?'':String(review.score);canvas.dataset.storyOpinion=review.opinion;canvas.dataset.layoutVersion='6';canvas.dataset.storyTemplate=template;
  return {titleLines,opinionLines:opinion.lines,opinionBottom,score:review.score};
}
