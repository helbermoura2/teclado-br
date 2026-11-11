import assert from 'node:assert/strict';
import {RecommendationEngine} from '../web/recommendations.js';
const map=new Map();const engine=new RecommendationEngine({storage:{getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)},details:async item=>item});
const saved=[{id:'tt0253474',type:'movie',name:'The Pianist',genres:['Drama','War'],status:'watched'}];
const result=await engine.recommend(saved);assert.ok(result.items.length>=5);assert.ok(result.items.every(item=>item.id!==saved[0].id));assert.ok(result.items.some(item=>item.type==='movie'));assert.ok(result.items.some(item=>item.type==='series'));
console.log('Verified free live discovery catalog:',result.items.length,'unseen titles; types:',[...new Set(result.items.map(item=>item.type))].join(', '));
