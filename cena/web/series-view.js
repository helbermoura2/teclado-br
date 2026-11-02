export function seriesSummary(row,now=Date.now()){
 if(!row?.checkedAt)return {state:'unknown',headline:'Aguardando consulta',detail:'Ainda não há dados confirmados desta série.'};
 const available=Math.max(0,Number(row.available)||0),next=row.next||{},date=Date.parse(next.firstAired||''),code=next.season>0&&next.number>0?`T${next.season} · E${next.number}`:'';
 const future=Number.isFinite(date)&&date>now;
 if(available>0)return {state:row.error?'stale':row.newEpisodes>0?'new':'available',headline:row.newEpisodes>0?`${row.newEpisodes} ${row.newEpisodes===1?'novo episódio':'novos episódios'} · ${available} para assistir`:`${available} ${available===1?'episódio':'episódios'} para assistir`,detail:code?`Próximo: ${code}${next.title?' · '+next.title:''}`:'Abra a série para escolher um episódio.'};
 if(future)return {state:row.error?'stale':'upcoming',headline:'Em dia',detail:`Próximo: ${code} · ${new Date(date).toLocaleDateString('pt-BR')}`};
 if(row.aired===0)return {state:'unknown',headline:'Sem lançamento confirmado',detail:code?`Próximo: ${code} · data a confirmar`:'Aguardando episódios lançados.'};
 return {state:row.error?'stale':'caught-up',headline:'Em dia',detail:code?`Próximo: ${code} · lançamento a confirmar`:'Você viu todos os episódios lançados confirmados.'};
}
