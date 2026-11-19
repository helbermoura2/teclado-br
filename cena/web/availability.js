const modes = [
  ['flatrate', 'Assinatura'], ['free', 'Grátis'], ['ads', 'Com anúncios'],
  ['rent', 'Aluguel'], ['buy', 'Compra'],
];

export function availabilityRows(value) {
  return modes.flatMap(([mode, label]) => {
    const raw = value?.groups?.[mode];
    if (!Array.isArray(raw)) return [];
    const names = [...new Set(raw.filter(name => typeof name === 'string' && name.trim()).map(name => name.trim().slice(0, 60)))];
    return names.length ? [{ label, names }] : [];
  });
}

export function cinemaLabel(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  return match ? `Estreia prevista no cinema · ${match[3]}/${match[2]}/${match[1]}` : '';
}

export function storyAvailability(value, watchedInCinema=false) {
  const rows=availabilityRows(value);
  const limit=watchedInCinema?2:3;
  const selected=rows.slice(0,limit);
  const rental=rows.find(row=>row.label==='Aluguel');
  if(rental&&!selected.includes(rental))selected[limit-1]=rental;
  return [...selected.map(({label,names})=>label+' · '+names.slice(0,3).join(', ')),...(watchedInCinema?['Cinema · Assisti no cinema']:[])];
}
