/* Save the same category/type combinations used by the public shop filters. */
(function(root) {
  'use strict';
  const groups = {
    outfits: ['Senator','Agbada','Outfits','Ready-Made','Clothing'],
    materials: ['Fabrics'],
    accessories: ['Shoes','Watches','Cufflinks','Caps','Sunglasses','Belts','Perfumes','Accessories']
  };
  const labels = {outfits:'Ready-made & Outfits',materials:'Fabrics & Materials',accessories:'Accessories & Extras'};
  function sectionOf(p) {
    if (/^(fabrics?|materials?)$/i.test(p.category || '') || /^fabrics?\s*\/\s*materials?$/i.test(p.productType || '')) return 'materials';
    if (/^(senator|agbada|outfits?|ready-made|clothing)$/i.test(p.category || '') || /^(ready-made|custom sewing)$/i.test(p.productType || '')) return 'outfits';
    return 'accessories';
  }
  function normalize(section, category, type) {
    if (!groups[section]) throw Error('Choose where this product appears in the shop.');
    if (section === 'materials') return {category:'Fabrics',productType:'Fabric / Material'};
    if (section === 'outfits') return {
      category:groups.outfits.includes(category) ? category : 'Senator',
      productType:/custom|tailor|made.to.measure/i.test(type || '') ? 'Custom Sewing' : 'Ready-Made'
    };
    // Keep legacy accessory categories when editing; they are not outfit listings.
    return {category:category && sectionOf({category})==='accessories' ? category : 'Accessories',productType:'Accessory'};
  }
  const api={groups,labels,sectionOf,normalize};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  root.TimzyProductPlacement=api;
})(typeof window !== 'undefined' ? window : globalThis);
