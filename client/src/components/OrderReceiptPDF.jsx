import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';

// Polices modernes
Font.register({
    family: 'Inter',
    src: 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.ttf',
    fontWeight: 'normal',
});

Font.register({
    family: 'Inter',
    src: 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2ZL7W0Q5nw.ttf',
    fontWeight: 'bold',
});

const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontSize: 10,
        fontFamily: 'Inter',
        backgroundColor: '#ffffff',
    },

    // ==================== HEADER ====================
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingBottom: 20,
    },
    logoSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    logoPlaceholder: {
        width: 40,
        height: 40,
        backgroundColor: '#e53935',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shopName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
        letterSpacing: 2,
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
        marginBottom: 4,
    },
    orderDate: {
        fontSize: 9,
        color: '#6b7280',
    },

    // ==================== TITRE ====================
    titleContainer: {
        marginBottom: 25,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        letterSpacing: 4,
    },
    titleUnderline: {
        width: 60,
        height: 2,
        backgroundColor: '#e53935',
        marginTop: 8,
    },

    // ==================== SECTIONS ====================
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#111827',
        borderLeftWidth: 3,
        borderLeftColor: '#e53935',
        paddingLeft: 8,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginLeft: 12,
    },
    infoRow: {
        width: '50%',
        flexDirection: 'row',
        marginBottom: 8,
    },
    infoLabel: {
        width: 90,
        fontSize: 9,
        color: '#6b7280',
    },
    infoValue: {
        flex: 1,
        fontSize: 9,
        color: '#111827',
        fontWeight: 'bold',
    },

    // ==================== STATUS BADGE ====================
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    statusLabel: {
        fontSize: 9,
        color: '#6b7280',
        width: 90,
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
        fontSize: 9,
        fontWeight: 'bold',
    },
    statusDelivered: {
        backgroundColor: '#10b981',
        color: '#ffffff',
    },
    statusConfirmed: {
        backgroundColor: '#3b82f6',
        color: '#ffffff',
    },
    statusPending: {
        backgroundColor: '#f59e0b',
        color: '#ffffff',
    },
    statusShipped: {
        backgroundColor: '#8b5cf6',
        color: '#ffffff',
    },
    statusCancelled: {
        backgroundColor: '#ef4444',
        color: '#ffffff',
    },
    paymentBadge: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 20,
        fontSize: 9,
        fontWeight: 'bold',
        backgroundColor: '#f3f4f6',
        color: '#374151',
    },

    // ==================== TABLEAU ====================
    table: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#111827',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    headerCell: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#ffffff',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    productCol: { width: '45%', fontSize: 9, color: '#374151' },
    qtyCol: { width: '15%', fontSize: 9, color: '#374151', textAlign: 'center' },
    priceCol: { width: '20%', fontSize: 9, color: '#374151', textAlign: 'right' },
    totalCol: { width: '20%', fontSize: 9, fontWeight: 'bold', color: '#111827', textAlign: 'right' },

    // ==================== TOTAUX ====================
    totalsContainer: {
        marginTop: 20,
        alignItems: 'flex-end',
    },
    totalsBox: {
        width: 250,
        borderTopWidth: 2,
        borderTopColor: '#e53935',
        paddingTop: 12,
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    totalLabel: {
        fontSize: 10,
        color: '#6b7280',
    },
    totalValue: {
        fontSize: 10,
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
        fontSize: 12,
        fontWeight: 'bold',
        color: '#111827',
    },
    grandTotalValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#e53935',
    },

    // ==================== FOOTER ====================
    footer: {
        marginTop: 35,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 8,
        color: '#9ca3af',
        marginBottom: 2,
    },
    footerHighlight: {
        fontSize: 8,
        color: '#e53935',
        marginTop: 4,
    },
});

const getStatusStyle = (status) => {
    const statusMap = {
        'Delivered': styles.statusDelivered,
        'Confirmed': styles.statusConfirmed,
        'Order Placed': styles.statusPending,
        'Shipped': styles.statusShipped,
        'Out for Delivery': styles.statusShipped,
        'Cancelled': styles.statusCancelled,
    };
    return statusMap[status] || styles.statusPending;
};

const getStatusLabel = (status) => {
    const statusMap = {
        'Order Placed': 'COMMANDÉE',
        'Confirmed': 'CONFIRMÉE',
        'Shipped': 'EXPÉDIÉE',
        'Out for Delivery': 'EN LIVRAISON',
        'Delivered': 'LIVRÉE',
        'Cancelled': 'ANNULÉE',
    };
    return statusMap[status] || status;
};

const OrderReceiptPDF = ({ order, currency }) => {
    const orderDate = new Date(order.createdAt);
    const subtotal = order.items.reduce((sum, item) => 
        sum + ((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity), 0);
    const discount = subtotal - order.amount;
    const shipping = order.deliveryPrice || 0;
    const total = order.amount;

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* HEADER */}
                <View style={styles.header}>
                    <View style={styles.logoSection}>
                        <View style={styles.logoPlaceholder}>
                            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' }}>R</Text>
                        </View>
                        <View>
                            <Text style={styles.shopName}>RAMCI</Text>
                            <Text style={styles.shopSubtitle}>Votre boutique en ligne</Text>
                        </View>
                    </View>
                    <View style={styles.orderInfo}>
                        <Text style={styles.orderNumber}>FACTURE #{order._id.slice(-8)}</Text>
                        <Text style={styles.orderDate}>{orderDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
                        <Text style={styles.orderDate}>{orderDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                </View>

                {/* TITRE */}
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>FACTURE</Text>
                    <View style={styles.titleUnderline} />
                </View>

                {/* INFOS CLIENT */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Client</Text>
                    <View style={styles.infoGrid}>
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
                </View>

                {/* DÉTAILS COMMANDE */}
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
                            {order.paymentType === "COD" ? "Paiement à la livraison" : "Paiement en ligne"}
                        </Text>
                    </View>
                </View>

                {/* TABLEAU DES PRODUITS */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.headerCell, styles.productCol]}>PRODUIT</Text>
                        <Text style={[styles.headerCell, styles.qtyCol]}>QTÉ</Text>
                        <Text style={[styles.headerCell, styles.priceCol]}>P.U.</Text>
                        <Text style={[styles.headerCell, styles.totalCol]}>TOTAL</Text>
                    </View>
                    {order.items.map((item, idx) => (
                        <View key={idx} style={styles.tableRow}>
                            <Text style={styles.productCol}>
                                {item.product?.name || 'Produit indisponible'}
                                {item.color && item.color !== 'null' ? ` (${item.color})` : ''}
                                {item.size && item.size !== 'null' ? ` - ${item.size}` : ''}
                            </Text>
                            <Text style={styles.qtyCol}>{item.quantity}</Text>
                            <Text style={styles.priceCol}>
                                {(item.priceAtOrder || item.product?.offerPrice || 0).toLocaleString()} {currency}
                            </Text>
                            <Text style={styles.totalCol}>
                                {((item.priceAtOrder || item.product?.offerPrice || 0) * item.quantity).toLocaleString()} {currency}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* TOTAUX */}
                <View style={styles.totalsContainer}>
                    <View style={styles.totalsBox}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Sous-total</Text>
                            <Text style={styles.totalValue}>{subtotal.toLocaleString()} {currency}</Text>
                        </View>
                        {discount > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Réduction</Text>
                                <Text style={[styles.totalValue, { color: '#e53935' }]}>- {discount.toLocaleString()} {currency}</Text>
                            </View>
                        )}
                        {shipping > 0 && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Livraison</Text>
                                <Text style={styles.totalValue}>{shipping.toLocaleString()} {currency}</Text>
                            </View>
                        )}
                        <View style={styles.grandTotalRow}>
                            <Text style={styles.grandTotalLabel}>TOTAL TTC</Text>
                            <Text style={styles.grandTotalValue}>{total.toLocaleString()} {currency}</Text>
                        </View>
                    </View>
                </View>

                {/* FOOTER */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Merci de votre confiance</Text>
                    <Text style={styles.footerText}>www.ramci.com | contact@ramci.com</Text>
                    <Text style={styles.footerHighlight}>Ce document fait office de facture</Text>
                </View>
            </Page>
        </Document>
    );
};

export default OrderReceiptPDF;