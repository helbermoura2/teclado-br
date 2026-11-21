import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyHistoryMetadata,historyYearLabel,historyStats,historyDate,historyItem} from '../web/watch-history.js';
const item={id:'tt1335975',type:'movie',name:'47 Ronin',year:'2013',status:'watchlist'};
const state={scope:'account-a',media:[{id:item.id,type:'movie',plays:3,years:[2023,2026],unknownDates:1}],totals:{plays:3,movies:1},years:[{year:2023,plays:1},{year:2026,plays:1}],unknown:{plays:1}};
test('history years cross exact film identity without replacing release year, personal status or dates',()=>{
 const result=applyHistoryMetadata([item,{...item,id:'tt9999999',name:'47 Ronin'}],state);assert.equal(result[0].year,'2013');assert.equal(result[0].status,'watchlist');assert.deepEqual(result[0].historyInfo.years,[2023,2026]);assert.equal(result[1].historyInfo,undefined);assert.equal(historyYearLabel(result[0]),'Visto em 2023, 2026');assert.equal(result[0].historyInfo.plays,3);
});
test('unknown dates never become release dates and each provider/account remains isolated',()=>{
 const imported=applyHistoryMetadata([item],state);const changed=applyHistoryMetadata(imported,{scope:'account-b',media:[]});assert.equal(changed[0].historyInfo,undefined);
 assert.equal(historyDate({datePrecision:'unknown',watchedAt:'',year:2013}),'Data desconhecida');assert.equal(historyYearLabel({...item,historyInfo:{plays:1,years:[]}}),'Data desconhecida');
});
test('statistics filter by watch year and count series as episodes, without inventing unknown records',()=>{
 assert.equal(historyStats(state,'2026').plays,1);assert.equal(historyStats(state,'unknown').plays,1);assert.equal(historyStats(state).plays,3);assert.deepEqual(historyStats(state,'2001'),{});
 assert.equal(historyYearLabel({type:'series',historyInfo:{years:[2024,2025],plays:4}}),'Episódios em 2024, 2025');
});
test('history browsing includes titles outside the catalog without adding them or guessing names',()=>{
 const rows=[item];const record={id:'tt0903747',kind:'episode',name:'Breaking Bad',year:2008};const result=historyItem(record,rows);assert.equal(result.type,'series');assert.equal(result.id,'tt0903747');assert.equal(rows.length,1);assert.equal(historyItem({...record,id:'',mediaKey:'series:trakt:123'},rows).sourceUrl,undefined);
});
