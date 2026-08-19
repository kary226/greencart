import test from 'node:test';
import assert from 'node:assert/strict';
import { assainirRiche, assainirTexte } from '../utils/assainir.js';

// L'assainissement est une frontière de sécurité : ce qui entre en base doit
// être sûr en lui-même, indépendamment de la façon dont il sera affiché.

// ---- Texte pur (avis, nom et description de boutique) ----------------- //

test('assainirTexte | balise script | est entièrement retirée', () => {
    const r = assainirTexte('Super produit<script>alert(1)</script> !');
    assert.equal(r, 'Super produit !');
    assert.ok(!r.includes('script'));
});

test('assainirTexte | image avec gestionnaire onerror | ne laisse aucune balise', () => {
    const r = assainirTexte('<img src=x onerror=alert(1)>');
    assert.equal(r, '');
});

test('assainirTexte | contenu légitime avec un chevron | n_est pas mutilé', () => {
    // « 3 < 5 » est un avis parfaitement valide : le < ne doit pas rester
    // encodé en &lt; ni faire disparaître la suite.
    const r = assainirTexte('3 < 5 et prix top');
    assert.equal(r, '3 < 5 et prix top');
});

test('assainirTexte | esperluette et guillemets | reviennent en caractères lisibles', () => {
    assert.equal(assainirTexte('Rapport qualité & prix « au top »'), 'Rapport qualité & prix « au top »');
});

test('assainirTexte | entrée non textuelle | renvoie une chaîne vide', () => {
    assert.equal(assainirTexte(undefined), '');
    assert.equal(assainirTexte({ $ne: null }), '');
    assert.equal(assainirTexte(42), '');
});

// ---- HTML riche (description produit, Quill) -------------------------- //

test('assainirRiche | mise en forme légitime | est conservée', () => {
    const r = assainirRiche('<p>Robe <strong>wax</strong> taille <em>M</em></p>');
    assert.ok(r.includes('<strong>wax</strong>'));
    assert.ok(r.includes('<em>M</em>'));
});

test('assainirRiche | balise script au milieu du HTML | est retirée, le reste survit', () => {
    const r = assainirRiche('<p>Avant</p><script>alert(1)</script><p>Après</p>');
    assert.ok(r.includes('Avant'));
    assert.ok(r.includes('Après'));
    assert.ok(!r.includes('script'));
});

test('assainirRiche | gestionnaire d_événement inline | est supprimé', () => {
    const r = assainirRiche('<p onclick="steal()">Cliquez</p>');
    assert.ok(r.includes('Cliquez'));
    assert.ok(!r.includes('onclick'));
    assert.ok(!r.includes('steal'));
});

test('assainirRiche | lien javascript: | est neutralisé', () => {
    const r = assainirRiche('<a href="javascript:alert(1)">piège</a>');
    assert.ok(!r.includes('javascript:'));
});

test('assainirRiche | lien http légitime | reçoit une protection rel', () => {
    const r = assainirRiche('<a href="https://exemple.ci">voir</a>');
    assert.ok(r.includes('href="https://exemple.ci"'));
    assert.ok(r.includes('noopener'));
});

test('assainirRiche | iframe | est retirée', () => {
    const r = assainirRiche('<iframe src="https://mechant.example"></iframe><p>ok</p>');
    assert.ok(!r.includes('iframe'));
    assert.ok(r.includes('ok'));
});

test('assainirRiche | image (non autorisée dans une description) | est retirée', () => {
    // Les images de produit passent par l'upload dédié, pas par le HTML.
    const r = assainirRiche('<img src=x onerror=alert(1)><p>texte</p>');
    assert.ok(!r.includes('<img'));
    assert.ok(r.includes('texte'));
});

test('assainirRiche | entrée non textuelle | renvoie une chaîne vide', () => {
    assert.equal(assainirRiche(null), '');
    assert.equal(assainirRiche(['<p>x</p>']), '');
});
