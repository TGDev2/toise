import '@testing-library/jest-dom';

// jsdom n'implémente pas l'API Object URL. Les composants qui affichent un blob
// — aperçu local d'un upload, photo servie par une route authentifiée — s'en
// servent en création comme en révocation, et l'absence de `revokeObjectURL`
// fait tomber le nettoyage d'effet, pas le code testé. Les suites qui veulent
// observer ces appels posent leur propre espion par-dessus.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = () => 'blob:jsdom';
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = () => {};
}
