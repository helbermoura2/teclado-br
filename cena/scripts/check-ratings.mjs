import assert from 'node:assert/strict';
import {RatingsResolver} from '../web/ratings.js';
const resolver=new RatingsResolver();
for(const item of [{id:'tt1335975',type:'movie',name:'47 Ronin'},{id:'tt0903747',type:'series',name:'Breaking Bad'}]){
 const value=await resolver.resolve(item);assert.equal(typeof value,'number',`${item.name} must have a real public IMDb rating`);assert(value>=1&&value<=10);console.log('Public IMDb rating:',item.name,value);
}
