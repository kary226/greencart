import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: {
        padding: 35,
        fontSize: 10,
        fontFamily: 'Helvetica',
        backgroundColor: '#ffffff',
    },

    // HEADER
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

    // TITRE
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

    // SECTIONS
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
    infoRow: {
        flexDirection: 'row',
        marginBottom: 4,
        marginLeft: 10,
    },
    infoLabel: {
        width: 70,
        fontSize: 9,
        color: '#6b7280',
    },
    infoValue: {
        flex: 1,
        fontSize: 9,
        color: '#111827',
        fontWeight: 'bold',
    },

    // STATUS
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        marginLeft: 10,
    },
    statusLabel: {
        width: 70,
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
    },
    statusDelivered: { backgroundColor: '#10b981' },
    statusConfirmed: { backgroundColor: '#3b82f6' },
    statusPending: { backgroundColor: '#f59e0b' },
    statusShipped: { backgroundColor: '#8b5cf6' },
    statusCancelled: { backgroundColor: '#ef4444' },
    paymentBadge: {
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: 12,
        fontSize: 8,
        fontWeight: 'bold',
        backgroundColor: '#f3f4f6',
        color: '#374151',
    },

    // TABLEAU
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
    // ✅ Toutes les cellules d'en-tête en blanc
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

    // TOTAUX
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

    // Coupon badge
    couponBadgeUsed: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 8,
        fontSize: 8,
        fontWeight: 'bold',
        backgroundColor: '#d1fae5',
        color: '#065f46',
    },
    couponBadgeNone: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 8,
        fontSize: 8,
        color: '#9ca3af',
        backgroundColor: '#f3f4f6',
    },

    // FOOTER
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

const getStatusStyle = (status) => {
    const map = {
        'Delivered': styles.statusDelivered,
        'Confirmed': styles.statusConfirmed,
        'Order Placed': styles.statusPending,
        'Shipped': styles.statusShipped,
        'Out for Delivery': styles.statusShipped,
        'Cancelled': styles.statusCancelled,
    };
    return map[status] || styles.statusPending;
};

const getStatusLabel = (status) => {
    const map = {
        'Order Placed': 'COMMANDÉE',
        'Confirmed': 'CONFIRMÉE',
        'Shipped': 'EXPÉDIÉE',
        'Out for Delivery': 'EN LIVRAISON',
        'Delivered': 'LIVRÉE',
        'Cancelled': 'ANNULÉE',
    };
    return map[status] || status;
};

// ✅ Formatage correct : espace insécable comme séparateur de milliers, pas de virgule ni slash
const formatPrice = (price) => {
    const formatted = Math.round(price)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0'); // espace insécable
    return `${formatted} FCFA`;
};

const OrderReceiptPDF = ({ order, currency }) => {
    if (!order || !order.address) {
        return (
            <Document>
                <Page>
                    <View style={{ padding: 30 }}>
                        <Text>Données de commande manquantes</Text>
                    </View>
                </Page>
            </Document>
        );
    }

    const orderDate = new Date(order.createdAt);
    const subtotal = order.items.reduce((sum, item) =>
        sum + ((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity), 0);
    const discount = order.discountAmount || 0;
    const couponCode = order.couponApplied || null;
    const shipping = order.deliveryPrice || 0;
    const total = order.amount;

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* HEADER */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.shopName}>RAMCI</Text>
                        <Text style={styles.shopSubtitle}>Votre boutique en ligne</Text>
                    </View>
                    <View style={styles.orderInfo}>
                        <Text style={styles.orderNumber}>FACTURE #{order._id.slice(-8).toUpperCase()}</Text>
                        <Text style={styles.orderDate}>{orderDate.toLocaleDateString('fr-FR')}</Text>
                        <Text style={styles.orderDate}>{orderDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                </View>

                {/* TITRE */}
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>FACTURE</Text>
                    <View style={styles.titleUnderline} />
                </View>

                {/* CLIENT */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Client</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Nom complet</Text>
                        <Text style={styles.infoValue}>{order.address.firstName} {order.address.lastName}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Téléphone</Text>
                        <Text style={styles.infoValue}>{order.address.phone}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Adresse</Text>
                        <Text style={styles.infoValue}>{order.address.street}, {order.address.communeName || order.address.city}</Text>
                    </View>
                </View>

                {/* COMMANDE */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Commande</Text>
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Statut</Text>
                        <Text style={[styles.statusBadge, getStatusStyle(order.status)]}>
                            {getStatusLabel(order.status)}
                        </Text>
                    </View>
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Paiement</Text>
                        <Text style={styles.paymentBadge}>
                            {order.paymentType === 'COD' ? 'Paiement à la livraison' : 'Paiement en ligne'}
                        </Text>
                    </View>
                    {/* ✅ Ligne code promo : affiché qu'il y en ait un ou non */}
                    <View style={styles.statusRow}>
                        <Text style={styles.statusLabel}>Code promo</Text>
                        {couponCode ? (
                            <Text style={styles.couponBadgeUsed}>✓ {couponCode}</Text>
                        ) : (
                            <Text style={styles.couponBadgeNone}>Aucun code utilisé</Text>
                        )}
                    </View>
                </View>

                {/* TABLEAU PRODUITS */}
                <View style={styles.table}>
                    {/* ✅ En-têtes blancs sur fond noir — on applique headerCell sur chaque colonne */}
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, { width: '45%' }]}>PRODUIT</Text>
                        <Text style={[styles.headerCell, { width: '15%', textAlign: 'center' }]}>QTÉ</Text>
                        <Text style={[styles.headerCell, { width: '20%', textAlign: 'right' }]}>P.U.</Text>
                        <Text style={[styles.headerCell, { width: '20%', textAlign: 'right' }]}>TOTAL</Text>
                    </View>
                    {order.items.map((item, idx) => (
                        <View key={idx} style={[styles.tableRow, idx % 2 === 1 ? { backgroundColor: '#fafafa' } : {}]}>
                            <Text style={styles.productCol}>
                                {item.product?.name || 'Produit'}
                                {item.color && item.color !== 'null' ? ` (${item.color})` : ''}
                                {item.size && item.size !== 'null' ? ` - ${item.size}` : ''}
                            </Text>
                            <Text style={styles.qtyCol}>{item.quantity}</Text>
                            <Text style={styles.priceCol}>
                                {formatPrice(item.priceAtOrder || item.product?.offerPrice || 0)}
                            </Text>
                            <Text style={styles.totalCol}>
                                {formatPrice((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity)}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* TOTAUX */}
                <View style={styles.totalsContainer}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Sous-total</Text>
                            <Text style={styles.totalValue}>{formatPrice(subtotal)}</Text>
                        </View>

                        {/* ✅ Réduction affichée seulement si > 0 */}
                        {discount > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>
                                    Réduction{couponCode ? ` (${couponCode})` : ''}
                                </Text>
                                <Text style={[styles.totalValue, { color: '#e53935' }]}>
                                    − {formatPrice(discount)}
                                </Text>
                            </View>
                        )}

                        {/* ✅ Livraison toujours affichée avec son montant ou "Gratuit" */}
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Livraison</Text>
                            <Text style={styles.totalValue}>
                                {shipping > 0 ? formatPrice(shipping) : 'Gratuit'}
                            </Text>
                        </View>

                        <View style={styles.grandTotalRow}>
                            <Text style={styles.grandTotalLabel}>TOTAL TTC</Text>
                            <Text style={styles.grandTotalValue}>{formatPrice(total)}</Text>
                        </View>
                    </View>
                </View>

                {/* FOOTER */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Merci de votre confiance</Text>
                    <Text style={styles.footerText}>www.ramci.com | contact@ramci.com</Text>
                    <Text style={styles.footerText}>Ce document fait office de facture</Text>
                </View>

            </Page>
        </Document>
    );
};

export default OrderReceiptPDF;