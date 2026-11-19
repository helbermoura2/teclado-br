// All coordinates are export pixels. Keep important content inside Instagram's UI margins.
const backgrounds=new WeakMap();
export const storyLayout={width:1080,height:1920,safe:{top:220,bottom:1660,left:100,right:980}};
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
function fitText(ctx,text,width,maxLines,start,min,font="sans-serif",weight=600){let size=start,lines;for(;size>=min;size-=2){ctx.font=`${weight} ${size}px ${font}`;lines=wrapStoryText(ctx,text,width,100);if(lines.length<=maxLines)break;}size=Math.max(min,size);ctx.font=`${weight} ${size}px ${font}`;return {size,lines:wrapStoryText(ctx,text,width,maxLines)};}
export function renderStory(canvas,{image=null,title='',originalTitle='',year='',type='movie',caption='',rating='',brandMark=null,brandWordmark=null,availability=[]}={}){
  const ctx=canvas.getContext('2d');canvas.width=1080;canvas.height=1920;
  const {left,right,top}=storyLayout.safe;
  const width=right-left;
  const sans='Manrope, sans-serif';
  const imageTop=338,imageHeight=626;
  const cached=backgrounds.get(canvas);
  if(cached&&cached.image===image&&typeof ctx.putImageData==='function'){
    ctx.putImageData(cached.pixels,0,0);
  }else{
    ctx.fillStyle='#140e1d';ctx.fillRect(0,0,1080,1920);
    if(image){
      ctx.save();
      ctx.beginPath();ctx.roundRect(0,imageTop,1080,imageHeight,0);ctx.clip();
      const scale=Math.max(1080/image.width,imageHeight/image.height);
      const w=image.width*scale,h=image.height*scale;
      ctx.drawImage(image,(1080-w)/2,imageTop+(imageHeight-h)*.035,w,h);
      ctx.restore();
    }
    const shade=ctx.createLinearGradient(0,imageTop,0,imageTop+imageHeight);
    shade.addColorStop(0,'#100c1c12');
    shade.addColorStop(.53,'#140e1d00');
    shade.addColorStop(.78,'#140e1d66');
    shade.addColorStop(1,'#140e1d');
    ctx.fillStyle=shade;ctx.fillRect(0,imageTop,1080,imageHeight);
    if(typeof ctx.getImageData==='function')backgrounds.set(canvas,{image,pixels:ctx.getImageData(0,0,1080,1920)});
  }
  if(brandMark){
    ctx.save();ctx.globalAlpha=.075;
    ctx.drawImage(brandMark,495,1150,690,690);ctx.restore();
  }
  ctx.textAlign='left';ctx.textBaseline='top';
  if(brandMark&&brandWordmark){
    ctx.drawImage(brandMark,left-14,top-12,128,128);
    ctx.drawImage(brandWordmark,left+118,top+20,380,64);
  }else{
    ctx.fillStyle='#eee9f6';ctx.font=`800 42px ${sans}`;
    ctx.fillText('CENA IA',left,top+20);
  }
  const titleWidth=width;
  const colon=title.indexOf(': ');
  const heading=fitText(ctx,title,titleWidth,2,88,40,sans,800);
  const mainTitle=colon>0?title.slice(0,colon):'';
  const subtitle=colon>0?title.slice(colon+2):'';
  const subtitleSize=Math.round(heading.size*.79);
  const mainLines=wrapStoryText(ctx,mainTitle,titleWidth,10);
  ctx.font=`650 ${subtitleSize}px ${sans}`;
  const subLines=wrapStoryText(ctx,subtitle,titleWidth,10);
  const splitTitle=mainTitle&&subtitle&&mainLines.length+subLines.length<=2;
  const titleLines=splitTitle?[...mainLines,...subLines]:heading.lines;
  let cursor=image?963:640;
  const details=[String(year).match(/\d{4}/)?.[0],type==='series'?'Série':'Filme'].filter(Boolean).join(' · ');
  ctx.font=`800 25px ${sans}`;ctx.fillStyle='#efccff';
  ctx.fillText(details,left,cursor-38);
  titleLines.forEach((line,i)=>{
    const subtitleLine=splitTitle&&i>=mainLines.length;
    const size=subtitleLine?subtitleSize:heading.size;
    ctx.font=`${subtitleLine?650:800} ${size}px ${sans}`;
    ctx.fillStyle=subtitleLine?'#e7d8ed':'#f7f0ff';
    ctx.fillText(line,left,cursor);
    cursor+=size+8;
  });
  const review=storyOpinion(caption,rating);
  cursor=Math.max(cursor+24,image?1125:855);
  if(!availability.length&&originalTitle&&originalTitle.toLocaleLowerCase()!==title.toLocaleLowerCase()&&cursor<1250){
    ctx.font=`500 24px ${sans}`;ctx.fillStyle='#d6c8ea';
    ctx.fillText(wrapStoryText(ctx,originalTitle,width,1)[0]||'',left,cursor);cursor+=34;
  }
  const sources=availability.slice(0,3);
  const hasScore=review.score!==null;
  const opinionX=hasScore&&review.opinion?left+225:left;
  const opinion=fitText(ctx,review.opinion,right-opinionX,3,36,27,sans,400);
  if(hasScore){
    ctx.font=`800 48px ${sans}`;ctx.fillStyle='#edd6ff';
    ctx.fillText(`${String(review.score).replace('.',',')} / 10`,left,cursor);
    if(review.opinion){
      ctx.fillStyle='#6d537e';ctx.fillRect(opinionX-22,cursor+3,2,54);
    }
  }
  ctx.font=`400 ${opinion.size}px ${sans}`;
  ctx.fillStyle='#f6edf9';
  opinion.lines.forEach((line,i)=>ctx.fillText(line,opinionX,cursor+i*(opinion.size+10)));
  const opinionBottom=cursor+Math.max(hasScore?55:0,opinion.lines.length*(opinion.size+10));
  if(sources.length){
    const ruleY=Math.max(opinionBottom+28,image?1405:1190);
    ctx.textAlign='left';
    ctx.fillStyle='#ab91c2';ctx.fillRect(left,ruleY,width,1);
    ctx.fillStyle='#ddc9ed';ctx.font=`700 27px ${sans}`;
    ctx.beginPath();
    ctx.moveTo(left,ruleY+20);ctx.lineTo(left+19,ruleY+31);ctx.lineTo(left,ruleY+42);ctx.closePath();ctx.fill();
    ctx.fillText('ONDE ASSISTIR NO BRASIL',left+32,ruleY+16);
    let y=ruleY+53;
    const compact=sources.length>1;
    for(const row of sources){
      const separator=row.indexOf(' · ');
      const label=separator<0?'':row.slice(0,separator);
      const providers=(separator<0?row:row.slice(separator+3)).split(', ');
      const netflixAds=providers.findIndex(name=>/^Netflix (Standard with Ads|com anúncios)$/i.test(name));
      const hasBoth=netflixAds>=0&&providers.some(name=>/^Netflix$/i.test(name));
      if(hasBoth)providers.splice(netflixAds,1);
      else if(netflixAds>=0)providers[netflixAds]='Netflix com anúncios';
      const cinema=label.startsWith('Estreia');
      const icon=cinema?'▤':label==='Aluguel'?'◷':label==='Compra'?'↓':'▶';
      const contentX=left+61;
      ctx.fillStyle='#392748';ctx.beginPath();ctx.roundRect(left,y+2,44,44,10);ctx.fill();
      ctx.fillStyle='#edd6ff';ctx.font=`700 24px ${sans}`;
      ctx.textAlign='center';ctx.fillText(icon,left+22,y+9);ctx.textAlign='left';
      ctx.font=`700 ${compact?29:39}px ${sans}`;ctx.fillStyle='#fff';
      const names=wrapStoryText(ctx,providers.join(', '),right-contentX,compact?1:2);
      const lineHeight=compact?32:43;
      names.forEach((line,index)=>ctx.fillText(line,contentX,y+index*lineHeight));
      ctx.font=`500 ${compact?18:23}px ${sans}`;ctx.fillStyle='#d3bbdf';
      const detail=[label,hasBoth?'Também no plano com anúncios':''].filter(Boolean).join(' · ');
      if(detail)ctx.fillText(detail,contentX,y+names.length*lineHeight);
      y+=Math.max(49,names.length*lineHeight+(detail?27:7));

    }
    ctx.font=`500 20px ${sans}`;ctx.fillStyle='#c9b6d8';
    ctx.fillText('TMDB / JustWatch',left,y+6);
  }
  canvas.dataset.storyTitle=title;canvas.dataset.storyRating=review.score===null?'':String(review.score);canvas.dataset.storyOpinion=review.opinion;canvas.dataset.layoutVersion='11';
  return {titleLines,opinionLines:opinion.lines,opinionBottom,score:review.score};
}
