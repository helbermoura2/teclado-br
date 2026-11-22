const norm=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export const topics=[
 ['greek epic','mitologia e aventuras da Grécia antiga',/\b(trojan war|trojan|guerra de troia|helen of troy|odysseus|odisseu|ulisses|achilles|aquiles|ancient greece|ancient greek|greek forces|greek warriors?|greek heroes?|greek kings?|grecia antiga|greek mytholog\w*|mitologia grega|greek gods|deuses gregos|argonaut\w*|perseus|perseu|theseus|teseu|heracles|hercules|mount olympus|monte olimpo)\b/],
 ['president','presidente dos EUA',/\b(president|presidente|presidential|presidencial)\b/],
 ['samurai','samurais',/\b(samurais?|ronins?|shoguns?)\b/],['zombie','zumbis',/\b(zombies?|zumbis?|undead)\b/],
 ['heist','assaltos',/\b(heist|bank robb\w*|assalto[s]? a banco)\b/],['vampire','vampiros',/\b(vampir\w*)\b/],
 ['time travel','viagem no tempo',/\b(time travel|viagem no tempo)\b/],['martial arts','artes marciais',/\b(martial arts|kung fu|artes marciais)\b/],
 ['space','aventuras espaciais',/\b(outer space|spaceships?|astronaut\w*|espaconave\w*)\b/],['gangster','máfia',/\b(gangster\w*|mafia|mobsters?)\b/],
 ['hijack','sequestro de transporte',/\b(hijack\w*|sequestr\w*.{0,45}(aviao|aeronave|trem|onibus))\b/],
 ['hostage','reféns',/\b(hostages?|refens|refem)\b/],['terrorism','terrorismo',/\b(terroris\w*)\b/],
 ['siege','ataque ou cerco',/\b(siege|cerco|white house.{0,55}(attack|inva)|casa branca.{0,55}(ataque|inva))\b/],
 ['investigation','investigação',/\b(detectives?|investigat\w*|investigac\w*|detetives?)\b/],
];
export const topicLabel=topic=>topics.find(row=>row[0]===topic)?.[1]||topic;
const usPresident=/(?:\b(?:u\.?s\.?a?|united states|american|eua|estadunidense)\s+(?:[a-z]+\s+){0,2}(?:president|presidential)\b|\bpresidente?\s+(?:(?:dos?|da|de|of|the)\s+){0,4}(?:estados unidos|united states|eua|u\.?s\.?a?)\b|\bpresidente\s+(?:americano|estadunidense)\b)/;
export function storyText(item){return String(item.plot||item.description||'');}
export function evidenceFor(item,topic){
 const pattern=topics.find(row=>row[0]===topic)?.[2];if(!pattern)return '';
 for(const text of [...new Set([item.plot,item.description].filter(value=>typeof value==='string'&&value.trim()))]){
  const normalized=norm(text),match=normalized.match(pattern);if(!match)continue;
  if(topic==='president'&&!usPresident.test(normalized)&&!/\b(white house|casa branca|oval office|u\.?s\.? secret service|united states secret service)\b/.test(normalized))continue;
  const at=topic==='president'?(normalized.match(usPresident)?.index??match.index??0):(match.index||0);
  return text.slice(Math.max(0,at-60),Math.min(text.length,at+220)).trim();
 }
 return '';
}
export function narrativeTopics(item){return topics.filter(([key])=>evidenceFor(item,key)).map(([key])=>key);}
const genrePatterns={Action:/\b(acao|action)\b/,Horror:/\b(terror|horror)\b/,Comedy:/\b(comedia|comedy)\b/,Drama:/\b(drama)\b/,Romance:/\b(romance|romantic\w*)\b/,Animation:/\b(animac\w*|animation)\b/,Fantasy:/\b(fantasia|fantasy)\b/};
export function parseSimilarityRequest(query=''){
 const text=norm(query).slice(0,200),required=[],excluded=[],genres=[],excludedGenres=[];
 const negative=/(?:\bsem\b|\bnao (?:quero|inclua)\b|\bwithout\b|\bno\b)\s+([^,;.]+)/g;const negativeParts=[...text.matchAll(negative)].map(row=>row[1].split(/\b(?:mas|porem|but)\b/)[0]);
 for(const [key,,pattern]of topics){if(negativeParts.some(part=>pattern.test(part)))excluded.push(key);else if(pattern.test(text))required.push(key);}
 for(const [key,pattern]of Object.entries(genrePatterns)){if(negativeParts.some(part=>pattern.test(part)))excludedGenres.push(key);else if(pattern.test(text))genres.push(key);}
 let years=null;const decade=text.match(/\b(?:anos|decada de|decade)\s*(19\d0|20\d0|[5-9]0)\b/);if(decade){const first=Number(decade[1])<100?1900+Number(decade[1]):Number(decade[1]);years=[first,first+9];}else{const year=text.match(/\b(?:de|em|from)\s+(19\d{2}|20\d{2})\b/);if(year)years=[Number(year[1]),Number(year[1])];}
 const words=text.match(/[a-z]{4,}/g)||[],stop=new Set('quero filmes filme series serie mais menos maior muita muito pouco pouca acao action terror horror comedia comedy drama romance fantasia fantasy animacao animation presidente president presidential presidencial americanos americano americana american estados unidos envolve envolva envolvam envolvendo tenha tenham parecido parecidos semelhante semelhantes gostaria favor opcoes opcoes incluir inclua exclua without anos decada decade from samurai samurais ronin shogun zombies zombie zumbis zumbi undead vampiro vampiros vampire vampires heist bank robbery assalto banco martial arts artes marciais kung outer space spaceship astronaut espaconave mafia gangster gangsters refens refem hostage hostages terroristas terrorismo terrorist terrorists terrorism sequestro hijack hijacked hijacking investigation investigacao detetives detective viagem tempo time travel'.split(' '));
 const terms=required.length||genres.length||excluded.length||excludedGenres.length||years?[]:[...new Set(words.filter(word=>!stop.has(word)))].slice(0,5);
 return {query:String(query).slice(0,200),required,excluded,genres,excludedGenres,years,terms};
}
const genresOf=item=>(Array.isArray(item.genres)?item.genres:String(item.genre||'').split(/[·,|]/)).map(norm);
export function fitsSimilarityRequest(item,criteria){
 if(criteria.required.some(topic=>!evidenceFor(item,topic))||criteria.excluded.some(topic=>evidenceFor(item,topic)))return false;
 const genres=genresOf(item);
 const hasGenre=name=>genres.some(value=>genrePatterns[name].test(value));
 if(criteria.genres.some(name=>!hasGenre(name))||criteria.excludedGenres.some(hasGenre))return false;
 if(criteria.years&&!(Number(item.year)>=criteria.years[0]&&Number(item.year)<=criteria.years[1]))return false;
 const text=norm(storyText(item)+' '+(item.cast||[]).join(' ')+' '+item.name);
 return criteria.terms.every(term=>text.includes(term));
}
export function requestLabels(criteria){return [...criteria.required.map(topicLabel),...criteria.genres.map(value=>({Action:'ação',Horror:'terror',Comedy:'comédia',Drama:'drama',Romance:'romance',Animation:'animação',Fantasy:'fantasia'}[value])),...criteria.excluded.map(value=>'sem '+topicLabel(value)),...criteria.excludedGenres.map(value=>'sem '+value),...(criteria.years?[`${criteria.years[0]}–${criteria.years[1]}`]:[]),...criteria.terms];}
export const themeQueries={'greek epic':['Troy','Clash of the Titans','Wrath of the Titans','Immortals','Jason and the Argonauts','The Return'],president:['White House Down','Has Fallen','Big Game','president','presidente'],samurai:['samurai','ronin','shogun','sword of','rurouni kenshin'],zombie:['zombie','undead'],heist:['heist','bank robbery'],vampire:['vampire'], 'time travel':['time travel'], 'martial arts':['martial arts','kung fu'],space:['space','astronaut'],gangster:['gangster','mafia'],hijack:['hijack','Non-Stop','Executive Decision'],hostage:['hostage','Die Hard'],terrorism:['terrorist','Under Siege'],siege:['siege','White House'],investigation:['detective','investigation']};

