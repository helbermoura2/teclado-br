import {test} from 'node:test';import assert from 'node:assert/strict';
import {createTitleAliasResolver} from '../web/title-aliases.js';
const film={id:'tt0099772',type:'movie',name:'Hiroshima: Out of the Ashes',year:'1990'};
test('native regional titles are merged only into the pending exact IMDb identity and requests deduplicate',async()=>{
 let resolver,calls=0;resolver=createTitleAliasResolver({findTitleAliases(id,type){calls++;queueMicrotask(()=>resolver.accept({id,type,name:'Hiroshima - A Guerra da Sobrevivência',originalName:film.name,year:'1990',aliases:['Hiroshima - A Guerra da Sobrevivência',film.name]}));}});
 const [first,second]=await Promise.all([resolver.resolve(film),resolver.resolve(film)]);assert.equal(calls,1);assert.equal(first.id,film.id);assert.equal(first.name,'Hiroshima - A Guerra da Sobrevivência');assert.ok(first.aliases.includes(film.name));assert.deepEqual(second,first);await resolver.resolve(film);assert.equal(calls,1);
});
test('wrong IDs, timeout and invalid native alias payloads never change the catalog identity',async()=>{
 let resolver;resolver=createTitleAliasResolver({findTitleAliases(){queueMicrotask(()=>resolver.accept({id:'tt1234567',type:'movie',aliases:['Unrelated']}));}},{timeout:10});assert.deepEqual(await resolver.resolve(film),film);
 resolver=createTitleAliasResolver({findTitleAliases(id,type){queueMicrotask(()=>resolver.accept({id,type,aliases:[{title:'bad'}]}));}},{timeout:10});assert.deepEqual(await resolver.resolve(film),film);
 assert.deepEqual(await createTitleAliasResolver({}).resolve(film),film);
});
