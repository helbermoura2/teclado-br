import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availabilityRows, cinemaLabel} from '../web/availability.js';

test('keeps rentals and subscription availability distinct', () => {
  assert.deepEqual(availabilityRows({groups:{flatrate:['A',' A '],rent:['B'],buy:['C']}}), [
    {label:'Assinatura',names:['A']}, {label:'Aluguel',names:['B']}, {label:'Compra',names:['C']}
  ]);
  assert.deepEqual(availabilityRows({error:true}), []);
});
test('a film release date describes a planned premiere', () => {
  assert.equal(cinemaLabel('2027-01-15'), 'Estreia prevista no cinema · 15/01/2027');
  assert.equal(cinemaLabel(''), '');
});
