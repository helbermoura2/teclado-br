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
function fitText(ctx,text,width,maxLines,start,min){let size=start,lines;for(;size>=min;size-=2){ctx.font=`600 ${size}px sans-serif`;lines=wrapStoryText(ctx,text,width,100);if(lines.length<=maxLines)break;}size=Math.max(min,size);ctx.font=`600 ${size}px sans-serif`;return {size,lines:wrapStoryText(ctx,text,width,maxLines)};}
export function renderStory(canvas,{image=null,title='',originalTitle='',year='',type='movie',caption='',rating=''}={}){
  const ctx=canvas.getContext('2d');canvas.width=1080;canvas.height=1920;
  const cached=backgrounds.get(canvas);
  if(cached&&cached.image===image&&typeof ctx.putImageData==='function')ctx.putImageData(cached.pixels,0,0);
  else {
  ctx.fillStyle='#100e1c';ctx.fillRect(0,0,1080,1920);
  if(image){ctx.save();ctx.filter='blur(40px)';cover(ctx,image,-120,-120,1320,2160);ctx.restore();}
  ctx.fillStyle='rgba(8,10,18,.70)';ctx.fillRect(0,0,1080,1920);
  const tint=ctx.createLinearGradient(0,0,1080,1920);tint.addColorStop(0,'rgba(145,66,210,.25)');tint.addColorStop(.5,'rgba(28,21,50,.08)');tint.addColorStop(1,'rgba(109,55,164,.30)');ctx.fillStyle=tint;ctx.fillRect(0,0,1080,1920);
  if(typeof ctx.getImageData==='function')backgrounds.set(canvas,{image,pixels:ctx.getImageData(0,0,1080,1920)});
  }
  const p=storyLayout.poster;ctx.save();ctx.shadowColor='rgba(0,0,0,.60)';ctx.shadowBlur=50;ctx.shadowOffsetY=18;ctx.fillStyle='#211d2d';ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,18);ctx.fill();ctx.restore();
  ctx.save();ctx.beginPath();ctx.roundRect(p.x,p.y,p.width,p.height,18);ctx.clip();
  if(image)cover(ctx,image,p.x,p.y,p.width,p.height);
  else{ctx.fillStyle='#211d2d';ctx.fillRect(p.x,p.y,p.width,p.height);ctx.fillStyle='#bc8af5';ctx.textAlign='center';ctx.font='100px sans-serif';ctx.fillText('▲',540,650);}
  ctx.restore();ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle='#fff';
  const heading=fitText(ctx,title,880,2,62,38);const titleTop=1040;
  heading.lines.forEach((line,i)=>ctx.fillText(line,540,titleTop+i*(heading.size+8)));
  let cursor=titleTop+heading.lines.length*(heading.size+8)+12;
  if(originalTitle&&originalTitle.toLocaleLowerCase()!==title.toLocaleLowerCase()){
    ctx.font='24px sans-serif';ctx.fillStyle='#c2bdcf';ctx.fillText(wrapStoryText(ctx,originalTitle,850,1)[0]||'',540,cursor);cursor+=38;
  }
  ctx.font='26px sans-serif';ctx.fillStyle='#c2bdcf';ctx.fillText([String(year).match(/\d{4}/)?.[0],type==='series'?'Série':'Filme'].filter(Boolean).join(' · '),540,cursor);cursor+=48;
  const review=storyOpinion(caption,rating);
  if(review.score!==null){
    const badgeY=Math.max(1260,cursor);ctx.fillStyle='rgba(175,111,255,.20)';ctx.strokeStyle='rgba(204,162,255,.60)';ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(425,badgeY,230,76,38);ctx.fill();ctx.stroke();ctx.font='600 38px sans-serif';ctx.fillStyle='#fff';
    ctx.fillText(`${String(review.score).replace('.',',')} / 10`,540,badgeY+14);cursor=badgeY+108;
  }else cursor=Math.max(cursor,1300);
  const opinionTop=Math.min(1420,Math.max(cursor,1370));
  const opinion=fitText(ctx,review.opinion,860,3,44,32);ctx.fillStyle='#fff';
  opinion.lines.forEach((line,i)=>ctx.fillText(line,540,opinionTop+i*(opinion.size+10)));
  // The app signature uses the original filled purple triangle as its final glyph.
  ctx.font='800 52px sans-serif';const wordWidth=ctx.measureText('CEN').width,total=wordWidth+52;const start=(1080-total)/2;
  ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillStyle='#eee9f6';ctx.fillText('CEN',start,1636);
  const x=start+wordWidth+6;ctx.fillStyle='#b781fa';ctx.beginPath();ctx.moveTo(x,1636);ctx.lineTo(x+23,1594);ctx.lineTo(x+46,1636);ctx.closePath();ctx.fill();
  canvas.dataset.storyTitle=title;canvas.dataset.storyRating=review.score===null?'':String(review.score);canvas.dataset.storyOpinion=review.opinion;canvas.dataset.layoutVersion='2';
  return {titleLines:heading.lines,opinionLines:opinion.lines,opinionBottom:opinionTop+opinion.lines.length*(opinion.size+10),score:review.score};
}
