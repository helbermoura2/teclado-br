// All coordinates are export pixels. Keep important content inside Instagram's UI margins.
const backgrounds=new WeakMap();
export const storyLayout={width:1080,height:1920,safe:{top:220,bottom:1660,left:100,right:980}};
export const storyCaptionLimit=240;
export const defaultStoryLogoPosition={x:100,y:220};
export function constrainStoryLogo(position){
  const {x,y}=position||{};
  return {
    x:Number.isFinite(x)?Math.round(Math.min(555,Math.max(32,x))):defaultStoryLogoPosition.x,
    y:Number.isFinite(y)?Math.round(Math.min(1790,Math.max(35,y))):defaultStoryLogoPosition.y,
  };
}
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
function drawFogParticles(ctx,top,mark){
  let seed=2387;
  const next=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  const {width,height}=storyLayout;
  ctx.save();
  for(let i=0;i<132;i++){
    const x=12+next()*(width-24);
    const depth=next()**.72;
    const y=top+depth*(height-16-top);
    const size=.8+next()**3*5.2;
    const angle=next()*Math.PI;
    const alpha=(.13+next()*.38)*depth;
    if(mark&&x>mark.x-18&&x<mark.x+mark.size+18&&y>mark.y-18&&y<mark.y+mark.size+18)continue;
    ctx.globalAlpha=alpha;
    ctx.fillStyle=i%4===0?'#d2a1f6':'#9e66d1';
    ctx.shadowColor='#9b61d1';ctx.shadowBlur=size>4?9:0;
    ctx.beginPath();
    ctx.ellipse(x,y,size,size*(i%3===0?.48:.74),angle,0,Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

export function renderStory(canvas,{image=null,title='',originalTitle='',year='',type='movie',caption='',rating='',brandMark=null,brandWordmark=null,availability=[],providerIcons=new Map(),mist=null,logoPosition}={}){
  const ctx=canvas.getContext('2d');canvas.width=1080;canvas.height=1920;
  const {left,right}=storyLayout.safe;
  const width=right-left;
  const sans='Manrope, sans-serif';
  const serif='"Playfair Display", Georgia, serif';
  const imageHeight=1080;
  const cached=backgrounds.get(canvas);
  if(cached&&cached.image===image&&typeof ctx.putImageData==='function'){
    ctx.putImageData(cached.pixels,0,0);
  }else{
    const base=ctx.createLinearGradient(0,0,1080,1920);
    base.addColorStop(0,'#17111c');base.addColorStop(.52,'#18131f');base.addColorStop(1,'#150b22');
    ctx.fillStyle=base;ctx.fillRect(0,0,1080,1920);
    if(image){
      ctx.save();
      ctx.beginPath();ctx.roundRect(0,0,1080,imageHeight,0);ctx.clip();
      const scale=Math.max(1080/image.width,imageHeight/image.height)*(image.width>image.height?1.23:1);
      const w=image.width*scale,h=image.height*scale;
      ctx.filter='contrast(1.1) saturate(.90) sepia(.12)';
      ctx.drawImage(image,(1080-w)*.46,(imageHeight-h)*.045,w,h);
      ctx.restore();
    }
    const shade=ctx.createLinearGradient(0,0,0,imageHeight);
    shade.addColorStop(0,'#100c1c12');
    shade.addColorStop(.42,'#140e1d12');
    shade.addColorStop(.72,'#18131fbd');
    shade.addColorStop(1,'#18131f');
    ctx.fillStyle=shade;ctx.fillRect(0,0,1080,imageHeight);
    if(typeof ctx.createRadialGradient==='function'){
      for(const [x,y,r,color] of [[100,1320,490,'#8b64ae55'],[940,1580,500,'#61338d68'],[430,1850,420,'#7d509d50']]){
        const mist=ctx.createRadialGradient(x,y,0,x,y,r);
        mist.addColorStop(0,color);mist.addColorStop(1,'#45256100');
        ctx.fillStyle=mist;ctx.fillRect(x-r,y-r,r*2,r*2);
      }
    }
    if(typeof ctx.getImageData==='function')backgrounds.set(canvas,{image,pixels:ctx.getImageData(0,0,1080,1920)});
  }
  if(mist)ctx.drawImage(mist,0,0,1080,1920);
  ctx.textAlign='left';ctx.textBaseline='top';
  const titleWidth=width-24;
  const displayTitle=title.trim().toLocaleUpperCase('pt-BR');
  const colon=displayTitle.indexOf(': ');
  let heading=fitText(ctx,displayTitle,titleWidth,2,88,40,serif,800);
  if(colon>0){
    const main=fitText(ctx,displayTitle.slice(0,colon),titleWidth,1,88,40,serif,800);
    const subtitle=fitText(ctx,displayTitle.slice(colon+2),titleWidth,1,88,40,serif,800);
    if(![...main.lines,...subtitle.lines].some(line=>line.endsWith('…'))){
      heading={size:Math.min(main.size,subtitle.size),lines:[...main.lines,...subtitle.lines]};
    }
  }
  const titleLines=heading.lines;
  const originalTitleY=image?803:701;
  const titleOffset=image?storyLayout.height/2+38-originalTitleY:0;
  let cursor=originalTitleY+titleOffset;
  const details=[String(year).match(/\d{4}/)?.[0],type==='series'?'Série':'Filme'].filter(Boolean).join(' · ');
  ctx.font=`800 25px ${sans}`;ctx.fillStyle='#e9dfe8';
  ctx.fillText(details.toLocaleUpperCase('pt-BR'),left,cursor-38);
  ctx.save();
  ctx.font=`800 ${heading.size}px ${serif}`;
  ctx.globalAlpha=.92;ctx.shadowColor='#0c0712';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
  ctx.strokeStyle='#d1b788';ctx.lineWidth=2;
  for(const line of titleLines){
    const gold=ctx.createLinearGradient(0,cursor,0,cursor+heading.size);
    gold.addColorStop(0,'#d9c49c');gold.addColorStop(.36,'#a18a70');gold.addColorStop(.58,'#ddd0ab');gold.addColorStop(1,'#735b4d');
    ctx.fillStyle=gold;
    ctx.strokeText?.(line,left,cursor,titleWidth);
    ctx.fillText(line,left,cursor,titleWidth);
    cursor+=heading.size+8;
  }
  ctx.restore();
  const review=storyOpinion(caption,rating);
  const reviewMinimum=image?1120:915;
  // Preserve the previous watermark position while moving the text below the artwork.
  let originalReviewY=Math.max(cursor-titleOffset+24,reviewMinimum);
  cursor=Math.max(cursor+24,reviewMinimum+(image?120:0));
  const showOriginalTitle=!availability.length&&originalTitle&&originalTitle.toLocaleLowerCase()!==title.toLocaleLowerCase();
  if(showOriginalTitle&&originalReviewY<1250)originalReviewY+=34;
  if(showOriginalTitle&&cursor<1370){
    ctx.font=`500 24px ${sans}`;ctx.fillStyle='#d6c8ea';
    ctx.fillText(wrapStoryText(ctx,originalTitle,width,1)[0]||'',left,cursor);cursor+=34;
  }
  const sources=availability.slice(0,3);
  const hasScore=review.score!==null;
  const opinionX=hasScore&&review.opinion?left+225:left;
  const opinion=fitText(ctx,review.opinion,right-opinionX,review.opinion.length>110?6:3,36,24,sans,400);
  if(hasScore){
    ctx.font=`800 48px ${sans}`;ctx.fillStyle='#f2ce8e';
    ctx.fillText(`${String(review.score).replace('.',',')} / 10`,left,cursor);
    const stars='★★★★★',starsY=cursor+54;
    ctx.font=`700 31px ${sans}`;
    const starsWidth=ctx.measureText(stars).width;
    ctx.fillStyle='#ad94b8';ctx.fillText('☆☆☆☆☆',left,starsY);
    if(review.score>0){
      ctx.save();ctx.beginPath();
      ctx.roundRect(left,starsY,starsWidth*review.score/10,38,0);ctx.clip();
      ctx.fillStyle='#eed095';ctx.fillText(stars,left,starsY);ctx.restore();
    }
    if(review.opinion){
      ctx.fillStyle='#9865b1';ctx.fillRect(opinionX-22,cursor+3,3,86);
    }
  }
  ctx.font=`400 ${opinion.size}px ${sans}`;
  ctx.fillStyle='#f6edf9';
  opinion.lines.forEach((line,i)=>ctx.fillText(line,opinionX,cursor+i*(opinion.size+10)));
  const reviewHeight=Math.max(hasScore?89:0,opinion.lines.length*(opinion.size+10));
  const opinionBottom=cursor+reviewHeight;
  const markY=Math.max(1230,originalReviewY+reviewHeight+28);
  const markSize=Math.min(560,1880-markY);
  const mark=brandMark&&markSize>0?{x:1160-markSize,y:markY,size:markSize}:null;
  const particlesTop=Math.max(1440,opinionBottom+24);
  if(particlesTop<1880)drawFogParticles(ctx,particlesTop,mark);
  if(mark){
    const {x,y,size}=mark;
    ctx.save();
    ctx.globalAlpha=.46;
    ctx.drawImage(brandMark,x,y,size,size);
    ctx.restore();
    if(mist){
      ctx.save();ctx.beginPath();ctx.roundRect(x,y,size,size,0);ctx.clip();
      ctx.globalAlpha=.62;ctx.drawImage(mist,0,0,1080,1920);ctx.restore();
    }
  }
  const providers=[...new Set(sources.flatMap(row=>{
    const separator=row.indexOf(' · ');
    if(separator<0||row.startsWith('Cinema · '))return [];
    return row.slice(separator+3).split(', ').map(name=>
      /^Netflix Standard with Ads$/i.test(name)?'Netflix com anúncios':name);
  }))];
  if(providers.includes('Netflix')){
    const ads=providers.indexOf('Netflix com anúncios');
    if(ads>=0)providers.splice(ads,1);
  }
  if(providers.length){
    // A marca usa uma área de até 560 px ancorada em x=1160.
    const providerRight=brandMark?572:right;
    const startY=opinionBottom+28;
    const rowHeight=Math.min(56,(1788-startY)/providers.length);
    const iconSize=Math.min(42,rowHeight-6);
    providers.forEach((name,index)=>{
      const y=startY+index*rowHeight;
      const icon=providerIcons.get(name)||(name==='Netflix com anúncios'?providerIcons.get('Netflix'):null);
      if(icon){
        ctx.save();ctx.beginPath();
        ctx.roundRect(left,y+(rowHeight-iconSize)/2,iconSize,iconSize,8);ctx.clip();
        ctx.drawImage(icon,left,y+(rowHeight-iconSize)/2,iconSize,iconSize);
        ctx.restore();
      }
      const nameX=left+(icon?iconSize+14:0);
      const size=Math.min(27,Math.floor((rowHeight-4)/1.6));
      const heading=fitText(ctx,name,providerRight-nameX,1,size,Math.min(18,size),sans,700);
      ctx.fillStyle='#f9f2fa';
      ctx.fillText(heading.lines[0],nameX,y+(rowHeight-heading.size)/2,providerRight-nameX);
    });
  }
  const logo=constrainStoryLogo(logoPosition);
  ctx.textAlign='left';ctx.textBaseline='top';
  if(brandMark&&brandWordmark){
    ctx.drawImage(brandMark,logo.x-11,logo.y-3,100,100);
    ctx.drawImage(brandWordmark,logo.x+101,logo.y+18,392,66);
  }else{
    ctx.fillStyle='#eee9f6';ctx.font=`800 42px ${sans}`;
    ctx.fillText('CENA IA',logo.x,logo.y+20);
  }
  canvas.dataset.logoX=String(logo.x);canvas.dataset.logoY=String(logo.y);
  canvas.dataset.storyTitle=title;canvas.dataset.storyRating=review.score===null?'':String(review.score);canvas.dataset.storyOpinion=review.opinion;canvas.dataset.layoutVersion='29';
  return {titleLines,opinionLines:opinion.lines,opinionBottom,score:review.score,opinionTruncated:opinion.lines.join('').replace(/\s/g,'')!==review.opinion.replace(/\s/g,'')};
}
