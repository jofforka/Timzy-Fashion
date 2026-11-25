(() => {
  const form = document.getElementById('fitComparison');
  if (!form) return;

  const results = document.getElementById('fitComparisonResults');
  const pairs = [
    ['Top chest', 'bodyChest', 'garmentChest'],
    ['Trouser waist', 'bodyWaist', 'garmentWaist'],
    ['Trouser hips', 'bodyHips', 'garmentHips'],
  ];
  const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

  form.addEventListener('input', () => results.replaceChildren());
  form.addEventListener('submit', event => {
    event.preventDefault();
    const list = document.createElement('ul');
    for (const [label, bodyName, garmentName] of pairs) {
      const body = form.elements.namedItem(bodyName);
      const garment = form.elements.namedItem(garmentName);
      if (!body.value && !garment.value) continue;

      const item = document.createElement('li');
      const bodyValue = body.valueAsNumber;
      const garmentValue = garment.valueAsNumber;
      const difference = Math.round((garmentValue - bodyValue) * 100) / 100;
      if (!Number.isFinite(bodyValue) || !Number.isFinite(garmentValue)) {
        item.textContent = label + ' — enter both measurements.';
      } else if (bodyValue <= 0 || garmentValue <= 0 || !Number.isFinite(difference)) {
        item.textContent = label + ' — enter valid positive measurements in centimetres.';
      } else if (difference === 0) {
        item.textContent = label + ' — same circumference (to 0.01 cm); this does not establish fit.';
      } else {
        const amount = format.format(Math.abs(difference));
        const relation = difference > 0 ? ' larger' : ' smaller';
        item.textContent = label + ' — garment is ' + amount + ' cm' + relation + ' than the body measurement.';
      }
      list.appendChild(item);
    }
    if (list.childElementCount) results.replaceChildren(list);
    else results.textContent = 'Enter a body and garment measurement for at least one area.';
  });
})();
