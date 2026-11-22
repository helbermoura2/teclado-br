import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {coverInput,normalizeTitle,similarity} from '../web/identify-cover.js';
const reports=JSON.parse(await readFile(new URL('../qa/native-cover-layout.json',import.meta.url),'utf8'));
for(const name of ['numeric','cast']){
 const report=reports.find(row=>row.name===name);assert.ok(report,'Missing native OCR layout report: '+name);
 const input=coverInput(report.payload);console.log('Native OCR title roles:',JSON.stringify({case:name,query:input.query,lines:report.payload.lines}));
 if(/^\d+$/.test(report.expected))assert.equal(normalizeTitle(input.query),normalizeTitle(report.expected));
 else assert.ok(similarity(input.query,report.expected)>=.9,'Production title selection used cast or awards instead of the dominant title');
}
