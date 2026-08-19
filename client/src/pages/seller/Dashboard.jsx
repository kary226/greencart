import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import { getPresetImageUrl } from '../../utils/cloudinaryImage';
import {
    AlertTriangle, BarChart3, Clock, Download, PackageX, RefreshCw, Search, Table2, Wallet,
} from 'lucide-react';

import {
    PERIODES, LIBELLE_STATUT, agreger, dansFenetre, estCommandeReelle, fenetres,
    formaterJours, formaterMontant, repartitionPaiements, repartitionStatuts,
    serieTemporelle, stocksFaibles, topProduits, variation, ventesParCategorie,
} from './dashboard/metrics';
import { BadgeStatut, Carte, TableauDonnees, Tuile } from './dashboard/widgets';
import { BarresHorizontales, CourbeCA, LegendeCA, PartsPaiement } from './dashboard/charts';

const Dashboard = () => {
    const { currency, axios } = useAppContext();

    const [commandes, setCommandes] = useState([]);
    const [produits, setProduits] = useState([]);
    const [chargement, setChargement] = useState(true);
    const [rafraichit, setRafraichit] = useState(false);
    const [majLe, setMajLe] = useState(null);

    const [periode, setPeriode] = useState('30j');
    const [vueTableau, setVueTableau] = useState(false);
    const [recherche, setRecherche] = useState('');

    const charger = useCallback(async (silencieux = false) => {
        try {
            silencieux ? setRafraichit(true) : setChargement(true);
            const [{ data }, { data: dataProduits }] = await Promise.all([
                axios.get('/api/order/seller'),
                // admin-list : /list est paginée (12), les statistiques
                // produits portaient donc sur un échantillon arbitraire.
                axios.get('/api/product/admin-list'),
            ]);
            if (!data.success) throw new Error(data.message || 'Chargement des commandes impossible');
            setCommandes(data.orders || []);
            setProduits(dataProduits?.products || []);
            setMajLe(new Date());
        } catch (error) {
            toast.error(error.message);
        } finally {
            setChargement(false);
            setRafraichit(false);
        }
    }, [axios]);

    useEffect(() => { charger(); }, [charger]);

    /* ── Découpage temporel ───────────────────────────────────────────── */

    const decoupe = useMemo(() => {
        const { debut, fin, precDebut, precFin } = fenetres(periode);
        const courantes = commandes.filter(o => dansFenetre(o, debut, fin));
        const precedentes = precDebut ? commandes.filter(o => dansFenetre(o, precDebut, precFin)) : [];
        return { courantes, precedentes, comparaison: Boolean(precDebut) };
    }, [commandes, periode]);

    const stats = useMemo(() => agreger(decoupe.courantes), [decoupe.courantes]);
    const statsPrec = useMemo(
        () => (decoupe.comparaison ? agreger(decoupe.precedentes) : null),
        [decoupe.precedentes, decoupe.comparaison],
    );

    const serie = useMemo(() => serieTemporelle(decoupe.courantes, periode), [decoupe.courantes, periode]);
    const seriePrec = useMemo(() => {
        if (!decoupe.comparaison) return [];
        const { precFin } = fenetres(periode);
        return serieTemporelle(decoupe.precedentes, periode, precFin);
    }, [decoupe.precedentes, decoupe.comparaison, periode]);

    /* Les deux séries sont alignées par index, pas par date : c'est la
       comparaison « même rang dans la période », la seule qui ait un sens
       quand les fenêtres ne partagent pas leurs jours. */
    const donneesCourbe = useMemo(
        () => serie.map((p, i) => ({ ...p, caPrec: seriePrec[i]?.ca ?? null })),
        [serie, seriePrec],
    );

    const delta = (cle) => (statsPrec ? variation(stats[cle], statsPrec[cle]) : null);
    const labelPrec = ` vs ${PERIODES.find(p => p.cle === periode)?.label.toLowerCase()} préc.`;
    const noteSansBase = decoupe.comparaison ? 'aucune base de comparaison' : 'période complète';

    /* ── Répartitions ─────────────────────────────────────────────────── */

    const statuts = useMemo(() => repartitionStatuts(decoupe.courantes), [decoupe.courantes]);
    const paiements = useMemo(() => repartitionPaiements(decoupe.courantes), [decoupe.courantes]);
    const categories = useMemo(
        () => ventesParCategorie(decoupe.courantes, produits), [decoupe.courantes, produits],
    );
    const meilleurs = useMemo(
        () => topProduits(decoupe.courantes, produits), [decoupe.courantes, produits],
    );
    const stockBas = useMemo(() => stocksFaibles(produits), [produits]);

    /* ── Alertes : uniquement ce qui appelle une action ───────────────── */

    const alertes = useMemo(() => {
        const liste = [];
        if (stats.nbEnAttente > 0) liste.push({
            cle: 'paiement', ton: 'warn', Icone: Wallet,
            texte: `${stats.nbEnAttente} commande${stats.nbEnAttente > 1 ? 's' : ''} facturée${stats.nbEnAttente > 1 ? 's' : ''} mais non encaissée${stats.nbEnAttente > 1 ? 's' : ''}`,
            detail: formaterMontant(stats.caEnAttente, currency),
        });
        const epuises = stockBas.filter(s => s.stock === 0).length;
        if (epuises > 0) liste.push({
            cle: 'epuise', ton: 'warn', Icone: PackageX,
            texte: `${epuises} produit${epuises > 1 ? 's' : ''} épuisé${epuises > 1 ? 's' : ''}`,
            detail: 'réapprovisionner',
        });
        const aExpedier = decoupe.courantes.filter(
            o => o.status === 'Order Placed' || o.status === 'Confirmed',
        ).length;
        if (aExpedier > 0) liste.push({
            cle: 'expedier', ton: 'info', Icone: Clock,
            texte: `${aExpedier} commande${aExpedier > 1 ? 's' : ''} en attente d'expédition`,
            detail: 'à traiter',
        });
        return liste;
    }, [stats, stockBas, decoupe.courantes, currency]);

    /* ── Dernières commandes ──────────────────────────────────────────── */

    const commandesFiltrees = useMemo(() => {
        const q = recherche.trim().toLowerCase();
        const base = [...decoupe.courantes].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
        );
        if (!q) return base;
        return base.filter(o => {
            const client = `${o.address?.firstName || ''} ${o.address?.lastName || ''}`.toLowerCase();
            return o._id.toLowerCase().includes(q)
                || client.includes(q)
                || (LIBELLE_STATUT[o.status] || '').toLowerCase().includes(q);
        });
    }, [decoupe.courantes, recherche]);

    const exporterCSV = () => {
        const entetes = ['Commande', 'Date', 'Client', 'Statut', 'Paiement', 'Encaissé', 'Montant', 'Livraison', 'Remise', 'Coupon'];
        /* Le point-virgule et le BOM sont ce qu'attend Excel en locale
           française — sans eux, tout atterrit dans une seule colonne. */
        const echapper = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lignes = commandesFiltrees.map(o => [
            o._id.slice(-8),
            new Date(o.createdAt).toLocaleString('fr-FR'),
            `${o.address?.firstName || ''} ${o.address?.lastName || ''}`.trim(),
            LIBELLE_STATUT[o.status] || o.status,
            o.paymentType,
            o.isPaid ? 'oui' : 'non',
            o.amount ?? 0,
            o.deliveryPrice ?? 0,
            o.discountAmount ?? 0,
            o.couponApplied || '',
        ].map(echapper).join(';'));

        const blob = new Blob(['﻿' + [entetes.map(echapper).join(';'), ...lignes].join('\r\n')],
            { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `commandes-${periode}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (chargement) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center bg-ink-50">
                <div className="text-center">
                    <span aria-hidden="true"
                          className="block w-8 h-8 mx-auto rounded-full border-2 border-ink-200 border-t-ramses-600 animate-spin" />
                    <p className="mt-4 text-[13px] text-ink-500">Chargement du tableau de bord…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-ink-50 min-h-screen">
            <div className="p-4 sm:p-6 max-w-[1400px] mx-auto grid gap-4 sm:gap-5">

                {/* ── En-tête ──────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="rs-display text-[24px] sm:text-[28px]">Tableau de bord</h1>
                        <p className="text-[13px] text-ink-500 mt-1">
                            {majLe ? `Données à jour au ${majLe.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ' '}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={exporterCSV} className="rs-btn rs-btn--secondary">
                            <Download aria-hidden="true" size={16} />
                            <span className="hidden sm:inline">Exporter</span>
                        </button>
                        <button onClick={() => charger(true)} disabled={rafraichit} className="rs-btn rs-btn--secondary">
                            <RefreshCw aria-hidden="true" size={16} className={rafraichit ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">Actualiser</span>
                        </button>
                    </div>
                </div>

                {/* ── Ligne de filtres — pilote TOUT l'écran ───────────── */}
                <div className="rs-card flex items-center justify-between gap-3 flex-wrap !py-2.5">
                    <div role="group" aria-label="Période" className="flex items-center gap-1 flex-wrap">
                        {PERIODES.map(p => (
                            <button
                                key={p.cle}
                                onClick={() => setPeriode(p.cle)}
                                aria-pressed={periode === p.cle}
                                className={`min-h-[36px] px-3 rounded-lg text-[13px] font-semibold transition-colors ${
                                    periode === p.cle
                                        ? 'bg-ramses-600 text-white'
                                        : 'text-ink-500 hover:bg-ink-50'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {/* Jumelle accessible : chaque graphique doit avoir un
                        équivalent tabulaire, une infobulle ne peut pas être le
                        seul accès à une valeur. */}
                    <button
                        onClick={() => setVueTableau(v => !v)}
                        aria-pressed={vueTableau}
                        className="rs-btn rs-btn--ghost !min-h-[36px]"
                    >
                        {vueTableau ? <BarChart3 aria-hidden="true" size={16} /> : <Table2 aria-hidden="true" size={16} />}
                        {vueTableau ? 'Voir les graphiques' : 'Voir les données'}
                    </button>
                </div>

                {/* Pendant un rafraîchissement on garde le rendu précédent en
                    retrait plutôt que de repasser par un squelette : pas de
                    saut de mise en page. */}
                <div className={`grid gap-4 sm:gap-5 transition-opacity ${rafraichit ? 'opacity-60' : ''}`}>

                    {/* ── Alertes ──────────────────────────────────────── */}
                    {alertes.length > 0 && (
                        <ul className="grid gap-2 sm:grid-cols-3">
                            {alertes.map((alerte) => (
                                <li key={alerte.cle}
                                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 ${
                                        alerte.ton === 'warn' ? 'bg-warn-50' : 'bg-info-50'
                                    }`}>
                                    <alerte.Icone aria-hidden="true" size={17}
                                           className={alerte.ton === 'warn' ? 'text-warn-500 shrink-0' : 'text-info-500 shrink-0'} />
                                    <div className="min-w-0">
                                        <p className="text-[12.5px] font-semibold text-ink-800 leading-snug">{alerte.texte}</p>
                                        <p className="text-[11px] text-ink-500">{alerte.detail}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* ── KPI ──────────────────────────────────────────── */}
                    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                        <Tuile
                            label="Chiffre d'affaires encaissé"
                            valeur={formaterMontant(stats.caEncaisse, currency)}
                            delta={delta('caEncaisse')} deltaLabel={labelPrec} note={noteSansBase}
                            serie={serie.map(p => p.ca)}
                        />
                        <Tuile
                            label="Commandes"
                            valeur={stats.nbCommandes.toLocaleString('fr-FR')}
                            delta={delta('nbCommandes')} deltaLabel={labelPrec} note={noteSansBase}
                            serie={serie.map(p => p.commandes)}
                        />
                        <Tuile
                            label="Panier moyen"
                            valeur={formaterMontant(stats.panierMoyen, currency)}
                            delta={delta('panierMoyen')} deltaLabel={labelPrec} note={noteSansBase}
                        />
                        <Tuile
                            label="Taux de livraison"
                            valeur={`${Math.round(stats.tauxLivraison)}`} unite="%"
                            delta={delta('tauxLivraison')} deltaLabel={labelPrec} note={noteSansBase}
                        />
                    </div>

                    {/* ── Métriques secondaires ────────────────────────── */}
                    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                        <Tuile label="En attente d'encaissement"
                               valeur={formaterMontant(stats.caEnAttente, currency)}
                               note={`${stats.nbEnAttente} commande${stats.nbEnAttente > 1 ? 's' : ''}`} />
                        <Tuile label="Remises accordées"
                               valeur={formaterMontant(stats.remises, currency)}
                               note={`${stats.avecCoupon} commande${stats.avecCoupon > 1 ? 's' : ''} avec code`} />
                        <Tuile label="Délai de livraison"
                               valeur={formaterJours(stats.delaiMoyen)}
                               note={stats.ponctualite === null ? 'aucune estimation' : `${Math.round(stats.ponctualite)} % dans les délais`} />
                        <Tuile label="Taux d'annulation"
                               valeur={`${Math.round(stats.tauxAnnulation)}`} unite="%"
                               delta={delta('tauxAnnulation')} deltaLabel={labelPrec}
                               hausseEstBonne={false} note={noteSansBase} />
                    </div>

                    {/* ── Évolution ────────────────────────────────────── */}
                    <Carte
                        titre="Évolution du chiffre d'affaires"
                        sousTitre="Commandes encaissées uniquement"
                    >
                        {vueTableau ? (
                            <TableauDonnees
                                colonnes={[
                                    { cle: 'label', label: 'Période' },
                                    { cle: 'ca', label: 'CA encaissé', rendu: (l) => formaterMontant(l.ca, currency) },
                                    { cle: 'commandes', label: 'Commandes' },
                                ]}
                                lignes={serie}
                            />
                        ) : (
                            <>
                                <LegendeCA comparaison={decoupe.comparaison} />
                                <CourbeCA donnees={donneesCourbe} devise={currency} comparaison={decoupe.comparaison} />
                            </>
                        )}
                    </Carte>

                    {/* ── Entonnoir + paiements ────────────────────────── */}
                    <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
                        <Carte titre="Statut des commandes" sousTitre="Dans l'ordre du parcours, pas par volume">
                            {vueTableau ? (
                                <TableauDonnees
                                    colonnes={[{ cle: 'label', label: 'Statut' }, { cle: 'valeur', label: 'Commandes' }]}
                                    lignes={statuts}
                                />
                            ) : (
                                <BarresHorizontales lignes={statuts} vide="Aucune commande sur la période." />
                            )}
                        </Carte>

                        <Carte titre="Moyens de paiement">
                            {vueTableau ? (
                                <TableauDonnees
                                    colonnes={[{ cle: 'label', label: 'Moyen' }, { cle: 'valeur', label: 'Commandes' }]}
                                    lignes={paiements}
                                />
                            ) : (
                                <PartsPaiement parts={paiements} />
                            )}
                        </Carte>
                    </div>

                    {/* ── Catégories + meilleures ventes ───────────────── */}
                    <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
                        <Carte titre="Ventes par catégorie" sousTitre="Six premières">
                            {vueTableau ? (
                                <TableauDonnees
                                    colonnes={[
                                        { cle: 'label', label: 'Catégorie' },
                                        { cle: 'valeur', label: 'CA', rendu: (l) => formaterMontant(l.valeur, currency) },
                                    ]}
                                    lignes={categories}
                                />
                            ) : (
                                <BarresHorizontales
                                    lignes={categories}
                                    formater={(v) => formaterMontant(v, currency)}
                                />
                            )}
                        </Carte>

                        <Carte titre="Meilleures ventes">
                            {meilleurs.length === 0 ? (
                                <p className="px-4 py-8 text-center text-[13px] text-ink-400">Aucune vente sur la période.</p>
                            ) : (
                                <ul className="px-4 pb-4 grid gap-3">
                                    {meilleurs.map((p, i) => (
                                        <li key={p.id} className="flex items-center gap-3">
                                            <span className="w-5 text-[12px] font-bold text-ink-400 tabular-nums shrink-0">
                                                {i + 1}
                                            </span>
                                            {p.image ? (
                                                <img src={getPresetImageUrl(p.image, 'thumbnail')} alt=""
                                                     loading="lazy"
                                                     className="w-9 h-9 rounded-lg object-cover border border-ink-100 shrink-0" />
                                            ) : (
                                                <span className="w-9 h-9 rounded-lg bg-ink-50 shrink-0" />
                                            )}
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-[13px] text-ink-800 truncate">{p.nom}</span>
                                                <span className="block text-[11.5px] text-ink-400">
                                                    {formaterMontant(p.ca, currency)}
                                                </span>
                                            </span>
                                            <span className="text-[13px] font-semibold text-ink-900 tabular-nums shrink-0">
                                                {p.quantite}
                                                <span className="text-ink-400 font-medium ml-1">vendus</span>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Carte>
                    </div>

                    {/* ── Stock faible ─────────────────────────────────── */}
                    <Carte
                        titre="Stock faible"
                        sousTitre="Seuil : 5 unités — toutes périodes confondues"
                        action={
                            <span className="rs-badge rs-badge--neutral shrink-0">
                                {stockBas.length} produit{stockBas.length > 1 ? 's' : ''}
                            </span>
                        }
                    >
                        {stockBas.length === 0 ? (
                            <p className="px-4 py-8 text-center text-[13px] text-ink-400">
                                Aucun produit sous le seuil.
                            </p>
                        ) : (
                            <ul className="divide-y divide-ink-100">
                                {stockBas.slice(0, 8).map(({ produit, stock }) => (
                                    <li key={produit._id} className="flex items-center gap-3 px-4 py-2.5">
                                        <img src={getPresetImageUrl(produit.image?.[0], 'thumbnail')} alt=""
                                             loading="lazy"
                                             className="w-9 h-9 rounded-lg object-cover border border-ink-100 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] text-ink-800 truncate">{produit.name}</p>
                                            <p className="text-[11.5px] text-ink-400 truncate">
                                                {produit.category || produit.categories?.[0] || '—'}
                                            </p>
                                        </div>
                                        {/* Icône + libellé : une couleur seule ne
                                            porte jamais un statut. */}
                                        <span className={`flex items-center gap-1.5 text-[12px] font-semibold shrink-0 ${
                                            stock === 0 ? 'text-warn-500' : 'text-ink-600'
                                        }`}>
                                            {stock === 0 && <AlertTriangle aria-hidden="true" size={14} />}
                                            {stock === 0 ? 'Épuisé' : `${stock} restant${stock > 1 ? 's' : ''}`}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Carte>

                    {/* ── Commandes ────────────────────────────────────── */}
                    <Carte
                        titre="Commandes de la période"
                        action={
                            <span className="rs-badge rs-badge--neutral shrink-0">{commandesFiltrees.length}</span>
                        }
                    >
                        <div className="px-4 pb-3">
                            <div className="relative">
                                <Search aria-hidden="true" size={16}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                                <input
                                    type="search"
                                    value={recherche}
                                    onChange={(e) => setRecherche(e.target.value)}
                                    placeholder="Numéro, client ou statut"
                                    aria-label="Rechercher une commande"
                                    className="rs-input rs-input--icon-l"
                                />
                            </div>
                        </div>

                        {commandesFiltrees.length === 0 ? (
                            <p className="px-4 py-8 text-center text-[13px] text-ink-400">
                                {recherche ? 'Aucune commande ne correspond.' : 'Aucune commande sur la période.'}
                            </p>
                        ) : (
                            <ul className="divide-y divide-ink-100">
                                {commandesFiltrees.slice(0, 12).map(o => (
                                    <li key={o._id} className="flex items-start justify-between gap-3 px-4 py-3">
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-semibold text-ink-900 tabular-nums">
                                                #{o._id.slice(-8)}
                                            </p>
                                            <p className="text-[12px] text-ink-500 truncate">
                                                {`${o.address?.firstName || ''} ${o.address?.lastName || ''}`.trim() || 'Client inconnu'}
                                            </p>
                                            <p className="text-[11px] text-ink-400 tabular-nums">
                                                {new Date(o.createdAt).toLocaleString('fr-FR', {
                                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0 grid gap-1 justify-items-end">
                                            <p className="rs-money text-[14px]">
                                                {formaterMontant(o.amount, currency)}
                                            </p>
                                            <BadgeStatut statut={o.status} label={LIBELLE_STATUT[o.status] || o.status} />
                                            {!o.isPaid && estCommandeReelle(o) && o.status !== 'Cancelled' && (
                                                <span className="text-[11px] font-semibold text-warn-500">Non encaissée</span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {commandesFiltrees.length > 12 && (
                            <p className="px-4 py-2.5 text-center text-[12px] text-ink-400 bg-ink-50">
                                12 sur {commandesFiltrees.length} affichées — utilisez l'export pour la liste complète.
                            </p>
                        )}
                    </Carte>

                </div>
            </div>
        </div>
    );
};

export default Dashboard;
