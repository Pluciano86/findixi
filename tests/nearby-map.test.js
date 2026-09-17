import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/js/cercaDeMi.js', import.meta.url), 'utf8');
function node() {
  return { classList: { add() {}, remove() {}, toggle() {} }, children: [], hidden: true, append(...items) { this.children.push(...items); },
    replaceChildren() { this.children = []; }, style: {}, focus() {} };
}
for (const allowsProfile of [true, false]) {
  test(`selection respects profile access: ${allowsProfile}`, () => {
    const elements = Object.fromEntries(['selectedCommerce', 'selectedCommerceContent', 'closeCommerce'].map(id => [id, node()]));
    const context = vm.createContext({ document: { getElementById: id => elements[id], createElement: node },
      placeKey: p => `commerce:${p.id}`, selectedPlaceKey: null, userMarker: null,
      map: {}, mapStatus: node(), siguiendoUsuario: true, PLACEHOLDER_LOGO: 'fallback.png',
      resolverPlanComercio: () => ({ permite_perfil: allowsProfile }), showNavigationPicker() {} });
    const start = source.indexOf('let selectedMarker = null;');
    const end = source.indexOf('const $radio', start);
    vm.runInContext(source.slice(start, end), context);
    context.showCommerce({ id: 12, nombre: '<script>unsafe</script>', abierto: true }, { getElement: node, getLatLng: () => ({ lat: 18, lng: -66 }) });
    const [, summary, actions] = elements.selectedCommerceContent.children;
    assert.equal(summary.children[1].children[0].textContent, '<script>unsafe</script>');
    assert.equal(actions.children.length, allowsProfile ? 2 : 1);
    assert.equal(elements.selectedCommerce.hidden, false);
    assert.equal(context.siguiendoUsuario, false);
    context.closeCommerce();
    assert.equal(elements.selectedCommerce.hidden, true);
  });
}
