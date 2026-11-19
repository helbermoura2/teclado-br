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
export function renderStory(canvas,{image=null,title='',originalTitle='',year='',type='movie',caption='',rating='',brandMark=null,brandWordmark=null,availability=[],providerIcon=null}={}){
  const ctx=canvas.getContext('2d');canvas.width=1080;canvas.height=1920;
  const {left,right,top}=storyLayout.safe;
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
      const scale=Math.max(1080/image.width,imageHeight/image.height);
      const w=image.width*scale,h=image.height*scale;
      ctx.filter='contrast(1.1) saturate(.90) sepia(.12)';
      ctx.drawImage(image,(1080-w)/2,(imageHeight-h)*.02,w,h);
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
      for(let i=1;i<=85;i++){
        const x=(i*197.37)%1080,y=1470+(i*139.17)%450;
        const size=1+i%5;
        ctx.fillStyle=i%3===0?'#ba87d855':'#9a59cb49';
        ctx.fillRect(x,y,size,size);
      }
    }
    if(typeof ctx.getImageData==='function')backgrounds.set(canvas,{image,pixels:ctx.getImageData(0,0,1080,1920)});
  }
  if(brandMark){
    ctx.save();ctx.globalAlpha=.15;
    ctx.drawImage(brandMark,535,1080,640,640);ctx.restore();
  }
  ctx.textAlign='left';ctx.textBaseline='top';
  if(brandMark&&brandWordmark){
    ctx.drawImage(brandMark,left-11,top-3,100,100);
    ctx.drawImage(brandWordmark,left+101,top+18,392,66);
  }else{
    ctx.fillStyle='#eee9f6';ctx.font=`800 42px ${sans}`;
    ctx.fillText('CENA IA',left,top+20);
  }
  const titleWidth=width-24;
  const colon=title.indexOf(': ');
  const heading=fitText(ctx,title,titleWidth,2,88,40,serif,800);
  const mainTitle=colon>0?title.slice(0,colon):'';
  const subtitle=colon>0?title.slice(colon+2):'';
  const subtitleSize=Math.round(heading.size*.79);
  const mainLines=wrapStoryText(ctx,mainTitle,titleWidth,10);
  ctx.font=`650 ${subtitleSize}px ${sans}`;
  const subLines=wrapStoryText(ctx,subtitle,titleWidth,10);
  const splitTitle=mainTitle&&subtitle&&mainLines.length+subLines.length<=2;
  const titleLines=splitTitle?[...mainLines,...subLines]:heading.lines;
  let cursor=image?742:640;
  const details=[String(year).match(/\d{4}/)?.[0],type==='series'?'Série':'Filme'].filter(Boolean).join(' · ');
  ctx.font=`800 25px ${sans}`;ctx.fillStyle='#e9dfe8';
  ctx.fillText(details.toLocaleUpperCase('pt-BR'),left,cursor-38);
  const titleInk=ctx.createLinearGradient(0,cursor,0,cursor+95);
  titleInk.addColorStop(0,'#fff7e5');titleInk.addColorStop(1,'#c5a982');
  titleLines.forEach((line,i)=>{
    const subtitleLine=splitTitle&&i>=mainLines.length;
    const size=subtitleLine?subtitleSize:heading.size;
    ctx.font=`${subtitleLine?650:800} ${size}px ${subtitleLine?sans:serif}`;
    ctx.shadowColor='#140b19';ctx.shadowBlur=5;ctx.shadowOffsetY=2;
    ctx.fillStyle=subtitleLine?'#e5d4ba':titleInk;
    ctx.fillText(line,left,cursor);
    cursor+=size+8;
  });
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  if(subtitle){
    const lettering=fitText(ctx,subtitle.toLocaleUpperCase('pt-BR'),width,1,76,35,serif,800);
    const steel=ctx.createLinearGradient(0,cursor,0,cursor+lettering.size);
    steel.addColorStop(0,'#d9c49c');steel.addColorStop(.36,'#a18a70');steel.addColorStop(.58,'#ddd0ab');steel.addColorStop(1,'#735b4d');
    ctx.save();
    ctx.globalAlpha=.7;ctx.shadowColor='#0c0712';ctx.shadowBlur=6;ctx.shadowOffsetY=3;
    ctx.fillStyle=steel;ctx.fillText(lettering.lines[0],left,cursor+4);ctx.restore();
    cursor+=lettering.size+10;
  }
  const review=storyOpinion(caption,rating);
  cursor=Math.max(cursor+24,image?1060:855);
  if(!availability.length&&originalTitle&&originalTitle.toLocaleLowerCase()!==title.toLocaleLowerCase()&&cursor<1250){
    ctx.font=`500 24px ${sans}`;ctx.fillStyle='#d6c8ea';
    ctx.fillText(wrapStoryText(ctx,originalTitle,width,1)[0]||'',left,cursor);cursor+=34;
  }
  const sources=availability.slice(0,3);
  const hasScore=review.score!==null;
  const opinionX=hasScore&&review.opinion?left+225:left;
  const opinion=fitText(ctx,review.opinion,right-opinionX,3,36,27,sans,400);
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
  if(sources.length){
    const ruleY=Math.max(opinionBottom+28,image?1290:1150);
    ctx.textAlign='left';
    const panel=ctx.createLinearGradient(left,ruleY,right,ruleY+160);
    panel.addColorStop(0,'#3b3647d9');panel.addColorStop(1,'#30243cb8');
    ctx.fillStyle=panel;ctx.beginPath();ctx.roundRect(left-18,ruleY-5,width+36,58+sources.length*62+(sources.length===1?30:0),22);ctx.fill();
    ctx.strokeStyle='#d9c1e77a';ctx.lineWidth=2;ctx.stroke();
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
      if(providerIcon&&providers.some(name=>name.toLowerCase()===providerIcon.name.toLowerCase())){
        ctx.save();ctx.beginPath();ctx.roundRect(left,y+2,44,44,10);ctx.clip();
        ctx.drawImage(providerIcon.image,left,y+2,44,44);ctx.restore();
      }else{
        ctx.fillStyle='#edd6ff';ctx.font=`700 24px ${sans}`;
        ctx.textAlign='center';ctx.fillText(icon,left+22,y+9);ctx.textAlign='left';
      }
      ctx.font=`700 ${compact?29:39}px ${sans}`;ctx.fillStyle='#fff';
      const names=wrapStoryText(ctx,providers.join(', '),right-contentX,compact?1:2);
      const lineHeight=compact?32:43;
      names.forEach((line,index)=>ctx.fillText(line,contentX,y+index*lineHeight));
      ctx.font=`500 ${compact?18:23}px ${sans}`;ctx.fillStyle='#d3bbdf';
      const detail=label.toLocaleUpperCase('pt-BR');
      const detailY=y+names.length*lineHeight;
      if(detail)ctx.fillText(detail,contentX,detailY);
      if(hasBoth){
        const note='Também no plano com anúncios';
        const noteX=compact?contentX+ctx.measureText(detail).width+20:contentX;
        ctx.font=`italic 500 ${compact?18:21}px ${sans}`;
        ctx.fillText(note,noteX,detailY+(compact?0:25));
      }
      y+=Math.max(49,names.length*lineHeight+(detail?27:7)+(hasBoth&&!compact?25:0));

    }
    ctx.font=`500 20px ${sans}`;ctx.fillStyle='#c9b6d8';
    ctx.textAlign='center';ctx.fillText('TMDB / JustWatch',540,Math.max(y+20,1608));
  }
  canvas.dataset.storyTitle=title;canvas.dataset.storyRating=review.score===null?'':String(review.score);canvas.dataset.storyOpinion=review.opinion;canvas.dataset.layoutVersion='14';
  return {titleLines,opinionLines:opinion.lines,opinionBottom,score:review.score};
}
