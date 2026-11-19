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
      for(let i=1;i<=115;i++){
        const x=(i*197.37)%1080,y=1440+(i*139.17)%480;
        const size=1+i%5;
        ctx.fillStyle=i%3===0?'#ba87d855':'#9a59cb49';
        ctx.fillRect(x,y,size,size);
      }
    }
    if(typeof ctx.getImageData==='function')backgrounds.set(canvas,{image,pixels:ctx.getImageData(0,0,1080,1920)});
  }
  if(mist)ctx.drawImage(mist,0,0,1080,1920);
  ctx.textAlign='left';ctx.textBaseline='top';
  const titleWidth=width-24;
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
  let cursor=image?803:701;
  const details=[String(year).match(/\d{4}/)?.[0],type==='series'?'Série':'Filme'].filter(Boolean).join(' · ');
  ctx.font=`800 25px ${sans}`;ctx.fillStyle='#e9dfe8';
  ctx.fillText(details.toLocaleUpperCase('pt-BR'),left,cursor-38);
  const titleInk=ctx.createLinearGradient(0,cursor,0,cursor+95);
  titleInk.addColorStop(0,'#fff9e6');titleInk.addColorStop(.36,'#d8c7a3');titleInk.addColorStop(.53,'#fff6de');titleInk.addColorStop(1,'#958066');
  titleLines.forEach((line,i)=>{
    const subtitleLine=splitTitle&&i>=mainLines.length;
    const size=subtitleLine?subtitleSize:heading.size;
    ctx.font=`${subtitleLine?650:800} ${size}px ${sans}`;
    ctx.shadowColor='#140b19';ctx.shadowBlur=5;ctx.shadowOffsetY=2;
    ctx.strokeStyle='#584b3e';ctx.lineWidth=3;
    ctx.strokeText?.(line,left,cursor);
    ctx.fillStyle=subtitleLine?'#e5d4ba':titleInk;
    ctx.fillText(line,left,cursor);
    cursor+=size+8;
  });
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  if(subtitle){
    const lettering=fitText(ctx,subtitle.toLocaleUpperCase('pt-BR'),width*1.34,1,96,35,serif,800);
    const steel=ctx.createLinearGradient(0,cursor,0,cursor+lettering.size);
    steel.addColorStop(0,'#d9c49c');steel.addColorStop(.36,'#a18a70');steel.addColorStop(.58,'#ddd0ab');steel.addColorStop(1,'#735b4d');
    ctx.save();
    ctx.globalAlpha=.92;ctx.shadowColor='#0c0712';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
    ctx.strokeStyle='#d1b788';ctx.lineWidth=2;
    ctx.strokeText?.(lettering.lines[0],left,cursor+4,width);
    ctx.fillStyle=steel;ctx.fillText(lettering.lines[0],left,cursor+4,width);ctx.restore();
    cursor+=lettering.size+10;
  }
  const review=storyOpinion(caption,rating);
  cursor=Math.max(cursor+24,image?1120:915);
  if(!availability.length&&originalTitle&&originalTitle.toLocaleLowerCase()!==title.toLocaleLowerCase()&&cursor<1250){
    ctx.font=`500 24px ${sans}`;ctx.fillStyle='#d6c8ea';
    ctx.fillText(wrapStoryText(ctx,originalTitle,width,1)[0]||'',left,cursor);cursor+=34;
  }
  const sources=availability.slice(0,3);
  const hasScore=review.score!==null;
  const opinionX=hasScore&&review.opinion?left+225:left;
  const opinion=fitText(ctx,review.opinion,right-opinionX,review.opinion.length>110?6:3,36,24,sans,400);
  if(hasScore){
    ctx.font=`800 48px ${sans}`;ctx.fillStyle='#f5edf8';
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
  const opinionBottom=cursor+Math.max(hasScore?89:0,opinion.lines.length*(opinion.size+10));
  if(brandMark){
    const markY=Math.max(1230,opinionBottom+28);
    const markSize=Math.min(560,1880-markY);
    if(markSize>0){
      const markX=1160-markSize;
      ctx.save();
      ctx.globalAlpha=.46;
      ctx.drawImage(brandMark,markX,markY,markSize,markSize);
      ctx.restore();
      if(mist){
        ctx.save();ctx.beginPath();ctx.roundRect(markX,markY,markSize,markSize,0);ctx.clip();
        ctx.globalAlpha=.62;ctx.drawImage(mist,0,0,1080,1920);ctx.restore();
      }
    }
  }
  if(sources.length){
    const rows=sources.map(row=>{
      const separator=row.indexOf(' · ');
      const label=separator<0?'':row.slice(0,separator);
      const providers=(separator<0?row:row.slice(separator+3)).split(', ');
      const ads=providers.findIndex(name=>/^Netflix (Standard with Ads|com anúncios)$/i.test(name));
      const hasBoth=ads>=0&&providers.some(name=>/^Netflix$/i.test(name));
      if(hasBoth)providers.splice(ads,1);
      else if(ads>=0)providers[ads]='Netflix com anúncios';
      return {label,providers,hasBoth};
    });
    const multiple=rows.some(row=>row.providers.length>1);
    const panelX=left-12,panelWidth=multiple?650:700;
    const rowHeight=row=>row.label==='Cinema'?54:28+Math.ceil(row.providers.length/2)*61+(row.hasBoth?24:0);
    const panelHeight=56+rows.reduce((sum,row)=>sum+rowHeight(row),0);
    const ruleY=Math.max(opinionBottom+28,Math.min(image?1350:1210,1735-panelHeight));
    ctx.save();ctx.beginPath();ctx.roundRect(panelX,ruleY,panelWidth,panelHeight,27);ctx.clip();
    ctx.filter='blur(15px)';
    ctx.drawImage(canvas,0,0);
    ctx.restore();
    const glass=ctx.createLinearGradient(panelX,ruleY,panelX+panelWidth,ruleY+panelHeight);
    glass.addColorStop(0,'#5c5764a8');glass.addColorStop(.50,'#302b37c4');glass.addColorStop(1,'#31253b96');
    ctx.fillStyle=glass;ctx.beginPath();ctx.roundRect(panelX,ruleY,panelWidth,panelHeight,27);ctx.fill();
    const edge=ctx.createLinearGradient(0,ruleY,0,ruleY+panelHeight);
    edge.addColorStop(0,'#e1d8dc82');edge.addColorStop(1,'#bb9fc22e');
    ctx.strokeStyle=edge;ctx.lineWidth=1.4;ctx.stroke();
    const inset=left+12;
    ctx.fillStyle='#f3e8fa';ctx.beginPath();
    ctx.moveTo(inset,ruleY+21);ctx.lineTo(inset+13,ruleY+28);ctx.lineTo(inset,ruleY+35);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f0e7f1';ctx.font=`800 20px ${sans}`;
    ctx.fillText('ONDE ASSISTIR NO BRASIL',inset+25,ruleY+16);
    let y=ruleY+48;
    for(const [index,row] of rows.entries()){
      const {label,providers,hasBoth}=row;
      if(index){ctx.fillStyle='#e0cde621';ctx.fillRect(inset,y-4,panelWidth-48,1);}
      ctx.font=`750 15px ${sans}`;ctx.fillStyle='#cfb9d6';
      ctx.fillText(label.toLocaleUpperCase('pt-BR'),inset,y+6);
      if(label==='Cinema'){
        ctx.font=`700 23px ${sans}`;ctx.fillStyle='#fff';
        ctx.fillText('Assisti no cinema',inset,y+25);
      }else{
        const cellWidth=providers.length>1?(panelWidth-48)/2:panelWidth-48;
        providers.forEach((name,i)=>{
          const x=inset+16+(i%2)*cellWidth,tileY=y+26+Math.floor(i/2)*61;
          const icon=providerIcons.get(name)||(/^Netflix com anúncios$/i.test(name)?providerIcons.get('Netflix'):null);
          if(icon){
            ctx.save();ctx.beginPath();ctx.roundRect(x,tileY+2,44,44,9);ctx.clip();
            ctx.drawImage(icon,x,tileY+2,44,44);ctx.restore();
          }
          const nameX=x+(icon?56:0);
          const heading=fitText(ctx,name,cellWidth-(icon?74:22),2,27,20,sans,700);
          ctx.fillStyle='#f9f2fa';
          const nameY=tileY+(heading.lines.length===1?10:0);
          heading.lines.forEach((line,lineIndex)=>ctx.fillText(line,nameX,nameY+lineIndex*25));
        });
        if(hasBoth){
          ctx.font=`italic 500 17px ${sans}`;ctx.fillStyle='#d5c4d9';
          ctx.fillText('Também no plano com anúncios',inset,y+rowHeight(row)-24);
        }
      }
      y+=rowHeight(row);
    }
    if(rows.some(row=>row.label!=='Cinema')){
      ctx.font=`500 20px ${sans}`;ctx.fillStyle='#c9b6d8';
      ctx.textAlign='center';ctx.fillText('TMDB / JustWatch',540,Math.max(y+19,1668));
    }
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
  canvas.dataset.storyTitle=title;canvas.dataset.storyRating=review.score===null?'':String(review.score);canvas.dataset.storyOpinion=review.opinion;canvas.dataset.layoutVersion='23';
  return {titleLines,opinionLines:opinion.lines,opinionBottom,score:review.score,opinionTruncated:opinion.lines.join('').replace(/\s/g,'')!==review.opinion.replace(/\s/g,'')};
}
