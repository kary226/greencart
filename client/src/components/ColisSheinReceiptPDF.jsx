import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 35,
        fontSize: 10,
        fontFamily: 'Helvetica',
        backgroundColor: '#ffffff',
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingBottom: 20,
    },
    shopName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        letterSpacing: 1,
    },
    shopSubtitle: {
        fontSize: 8,
        color: '#9ca3af',
        marginTop: 2,
    },
    orderInfo: {
        textAlign: 'right',
    },
    orderNumber: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#e53935',
        marginBottom: 2,
    },
    orderDate: {
        fontSize: 9,
        color: '#6b7280',
    },

    titleContainer: {
        marginBottom: 25,
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
        letterSpacing: 2,
    },
    titleUnderline: {
        width: 50,
        height: 2,
        backgroundColor: '#e53935',
        marginTop: 6,
    },

    section: {
        marginBottom: 18,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#111827',
        borderLeftWidth: 2,
        borderLeftColor: '#e53935',
        paddingLeft: 6,
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        marginLeft: 10,
    },
    statusLabel: {
        width: 90,
        fontSize: 9,
        color: '#6b7280',
    },
    statusBadge: {
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 12,
        fontSize: 8,
        fontWeight: 'bold',
        color: '#ffffff',
        backgroundColor: '#e53935',
    },

    table: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 6,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#111827',
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    headerCell: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#ffffff',
        textTransform: 'uppercase',
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        backgroundColor: '#ffffff',
    },
    productCol: { width: '45%', fontSize: 9, color: '#374151' },
    qtyCol: { width: '15%', fontSize: 9, color: '#374151', textAlign: 'center' },
    priceCol: { width: '20%', fontSize: 9, color: '#374151', textAlign: 'right' },
    totalCol: { width: '20%', fontSize: 9, fontWeight: 'bold', color: '#111827', textAlign: 'right' },

    totalsContainer: {
        marginTop: 20,
        alignItems: 'flex-end',
    },
    totalsBox: {
        width: 240,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 10,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    totalLabel: {
        fontSize: 9,
        color: '#6b7280',
    },
    totalValue: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#111827',
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    grandTotalLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#111827',
    },
    grandTotalValue: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#e53935',
    },

    footer: {
        marginTop: 30,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 8,
        color: '#9ca3af',
        marginBottom: 2,
    },
});

const STATUT_LABELS = {
    achete: 'ACHETÉ CHEZ SHEIN',
    en_entrepot: 'ARRIVÉ EN ENTREPÔT',
    pese: 'PESÉ',
    solde_du: 'SOLDE À RÉGLER',
    solde_paye: 'SOLDE RÉGLÉ',
    en_livraison: 'EXPÉDIÉ',
    livre: 'LIVRÉ',
};

const money = (n, devise) => `${devise === 'EUR' ? '€' : '$'}${Number(n || 0).toFixed(2)}`;

const formatPriceFCFA = (price) => {
    const formatted = Math.round(price || 0)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    return `${formatted} FCFA`;
};

const ColisSheinReceiptPDF = ({ colis }) => {
    if (!colis) {
        return (
            <Document>
                <Page>
                    <View style={{ padding: 30 }}>
                        <Text>Données de colis manquantes</Text>
                    </View>
                </Page>
            </Document>
        );
    }

    const date = new Date(colis.createdAt);
    const articles = colis.articlesValides || [];
    const montantTotalFCFA =
        colis.devis?.montantFinal ??
        (colis.devis?.montantArticlesFCFA != null
            ? colis.devis.montantArticlesFCFA + (colis.devis.fraisLivraisonEstime || 0)
            : null);

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* HEADER */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.shopName}>RAMCI</Text>
                        <Text style={styles.shopSubtitle}>Colis SHEIN</Text>
                    </View>
                    <View style={styles.orderInfo}>
                        <Text style={styles.orderNumber}>REÇU {colis.numeroSuivi}</Text>
                        <Text style={styles.orderDate}>{date.toLocaleDateString('fr-FR')}</Text>
                        <Text style={styles.orderDate}>{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                </View>

                {/* TITRE */}
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>REÇU D'ACHAT</Text>
                    <View style={styles.titleUnderline} />
                </View>

                {/* COLIS */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Colis</Text>
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Numéro de suivi</Text>
                        <Text style={[styles.statusBadge]}>{colis.numeroSuivi}</Text>
                    </View>
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Statut</Text>
                        <Text style={{ fontSize: 9, color: '#111827', fontWeight: 'bold' }}>
                            {STATUT_LABELS[colis.statut] || colis.statut}
                        </Text>
                    </View>
                    {colis.devis?.poidsReel != null && (
                        <View style={styles.statusRow}>
                            <Text style={styles.statusLabel}>Poids réel</Text>
                            <Text style={{ fontSize: 9, color: '#111827', fontWeight: 'bold' }}>{colis.devis.poidsReel} kg</Text>
                        </View>
                    )}
                </View>

                {/* TABLEAU ARTICLES */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, { width: '45%' }]}>ARTICLE</Text>
                        <Text style={[styles.headerCell, { width: '15%', textAlign: 'center' }]}>QTÉ</Text>
                        <Text style={[styles.headerCell, { width: '20%', textAlign: 'right' }]}>P.U.</Text>
                        <Text style={[styles.headerCell, { width: '20%', textAlign: 'right' }]}>TOTAL</Text>
                    </View>
                    {articles.map((a, idx) => (
                        <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? { backgroundColor: '#fafafa' } : {}]}>
                            <Text style={styles.productCol}>
                                {a.nom || 'Article'}{a.variante ? ` (${a.variante})` : ''}
                            </Text>
                            <Text style={styles.qtyCol}>{a.quantite}</Text>
                            <Text style={styles.priceCol}>{money(a.prixUnitaire, colis.devise)}</Text>
                            <Text style={styles.totalCol}>{money((a.prixUnitaire || 0) * (a.quantite || 1), colis.devise)}</Text>
                        </View>
                    ))}
                </View>

                {/* TOTAUX */}
                <View style={styles.totalsContainer}>
                    <View style={styles.totalsBox}>
                        {colis.devis?.montantArticlesFCFA != null && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Montant articles</Text>
                                <Text style={styles.totalValue}>{formatPriceFCFA(colis.devis.montantArticlesFCFA)}</Text>
                            </View>
                        )}
                        {colis.devis?.fraisLivraisonEstime != null && colis.devis.fraisLivraisonEstime > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Frais de livraison</Text>
                                <Text style={styles.totalValue}>{formatPriceFCFA(colis.devis.fraisLivraisonEstime)}</Text>
                            </View>
                        )}
                        {montantTotalFCFA != null && (
                            <View style={styles.grandTotalRow}>
                                <Text style={styles.grandTotalLabel}>TOTAL</Text>
                                <Text style={styles.grandTotalValue}>{formatPriceFCFA(montantTotalFCFA)}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* FOOTER */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Merci de votre confiance</Text>
                    <Text style={styles.footerText}>www.ramci.com | contactramci@gmail.com</Text>
                    <Text style={styles.footerText}>Ce document atteste de l'achat de vos articles chez SHEIN</Text>
                </View>

            </Page>
        </Document>
    );
};

export default ColisSheinReceiptPDF;