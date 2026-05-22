import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
    family: 'Roboto',
    src: 'https://fonts.gstatic.com/s/roboto/v27/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf',
});

const styles = StyleSheet.create({
    page: {
        padding: 35,
        fontSize: 11,
        fontFamily: 'Roboto',
        backgroundColor: '#ffffff',
        lineHeight: 1.5,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 25,
        borderBottomWidth: 2,
        borderBottomColor: '#22c55e',
        paddingBottom: 15,
    },

    shopName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#22c55e',
        marginBottom: 4,
    },

    subtitle: {
        fontSize: 10,
        color: '#6b7280',
    },

    title: {
        fontSize: 22,
        textAlign: 'center',
        marginBottom: 25,
        fontWeight: 'bold',
        color: '#111827',
    },

    section: {
        marginBottom: 22,
    },

    sectionTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        backgroundColor: '#f3f4f6',
        padding: 8,
        borderRadius: 4,
        marginBottom: 10,
        color: '#111827',
    },

    row: {
        flexDirection: 'row',
        marginBottom: 8,
        alignItems: 'flex-start',
    },

    label: {
        width: 120,
        fontWeight: 'bold',
        color: '#374151',
    },

    value: {
        flex: 1,
        color: '#111827',
        flexWrap: 'wrap',
    },

    table: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 4,
        overflow: 'hidden',
    },

    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#22c55e',
        color: '#ffffff',
        paddingVertical: 10,
        paddingHorizontal: 8,
        fontWeight: 'bold',
        fontSize: 10,
    },

    tableRow: {
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        alignItems: 'center',
    },

    productCol: {
        width: '45%',
        paddingRight: 8,
        fontSize: 10,
    },

    qtyCol: {
        width: '15%',
        textAlign: 'center',
        fontSize: 10,
    },

    priceCol: {
        width: '20%',
        textAlign: 'right',
        fontSize: 10,
    },

    totalCol: {
        width: '20%',
        textAlign: 'right',
        fontSize: 10,
        fontWeight: 'bold',
    },

    totalContainer: {
        marginTop: 20,
        alignItems: 'flex-end',
    },

    totalBox: {
        width: 220,
        borderTopWidth: 2,
        borderTopColor: '#22c55e',
        paddingTop: 10,
    },

    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },

    totalLabel: {
        fontSize: 14,
        fontWeight: 'bold',
    },

    totalValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#22c55e',
    },

    footer: {
        marginTop: 40,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingTop: 15,
        textAlign: 'center',
        fontSize: 9,
        color: '#6b7280',
        lineHeight: 1.6,
    },

    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 20,
        fontSize: 9,
    },

    statusDelivered: {
        backgroundColor: '#d1fae5',
        color: '#065f46',
    },

    statusPending: {
        backgroundColor: '#fef3c7',
        color: '#92400e',
    },

    statusCancelled: {
        backgroundColor: '#fee2e2',
        color: '#991b1b',
    },
});

const getStatusStyle = (status) => {
    if (status === 'Livrée') return styles.statusDelivered;
    if (status === 'Annulée') return styles.statusCancelled;
    return styles.statusPending;
};

const OrderReceiptPDF = ({ order, currency }) => {

    const orderDate = new Date(order.createdAt);

    const statusLabel =
        order.status === 'Delivered'
            ? 'Livrée'
            : order.status === 'Cancelled'
            ? 'Annulée'
            : order.status === 'Shipped'
            ? 'Expédiée'
            : order.status === 'Confirmed'
            ? 'Confirmée'
            : 'Commandée';

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* HEADER */}
                <View style={styles.header}>

                    <View>
                        <Text style={styles.shopName}>GreenCart</Text>
                        <Text style={styles.subtitle}>
                            Votre marché en ligne
                        </Text>
                    </View>

                    <View>
                        <Text style={styles.subtitle}>
                            Commande : #{order._id.slice(-8)}
                        </Text>

                        <Text style={styles.subtitle}>
                            {orderDate.toLocaleDateString('fr-FR')}
                        </Text>

                        <Text style={styles.subtitle}>
                            {orderDate.toLocaleTimeString('fr-FR')}
                        </Text>
                    </View>

                </View>

                {/* TITLE */}
                <Text style={styles.title}>
                    FACTURE
                </Text>

                {/* CLIENT */}
                <View style={styles.section}>

                    <Text style={styles.sectionTitle}>
                        Informations client
                    </Text>

                    <View style={styles.row}>
                        <Text style={styles.label}>Nom :</Text>

                        <Text style={styles.value}>
                            {order.address.firstName} {order.address.lastName}
                        </Text>
                    </View>

                    <View style={styles.row}>
                        <Text style={styles.label}>Téléphone :</Text>

                        <Text style={styles.value}>
                            {order.address.phone}
                        </Text>
                    </View>

                    <View style={styles.row}>
                        <Text style={styles.label}>Adresse :</Text>

                        <Text style={styles.value}>
                            {order.address.street}, {order.address.city}
                        </Text>
                    </View>

                </View>

                {/* ORDER */}
                <View style={styles.section}>

                    <Text style={styles.sectionTitle}>
                        Détails de la commande
                    </Text>

                    <View style={styles.row}>
                        <Text style={styles.label}>Statut :</Text>

                        <Text style={[
                            styles.statusBadge,
                            getStatusStyle(statusLabel)
                        ]}>
                            {statusLabel}
                        </Text>
                    </View>

                    <View style={styles.row}>
                        <Text style={styles.label}>Paiement :</Text>

                        <Text style={styles.value}>
                            {order.paymentType === "COD"
                                ? "Paiement à la livraison"
                                : "Paiement en ligne"}
                        </Text>
                    </View>

                </View>

                {/* TABLE */}
                <View style={styles.table}>

                    <View style={styles.tableHeader}>
                        <Text style={styles.productCol}>Produit</Text>
                        <Text style={styles.qtyCol}>Qté</Text>
                        <Text style={styles.priceCol}>PU</Text>
                        <Text style={styles.totalCol}>Total</Text>
                    </View>

                    {order.items.map((item, idx) => (

                        <View key={idx} style={styles.tableRow}>

                            <Text style={styles.productCol}>
                                {item.product.name}
                            </Text>

                            <Text style={styles.qtyCol}>
                                {item.quantity}
                            </Text>

                            <Text style={styles.priceCol}>
                                {(item.priceAtOrder || item.product.offerPrice)} {currency}
                            </Text>

                            <Text style={styles.totalCol}>
                                {(item.priceAtOrder || item.product.offerPrice) * item.quantity} {currency}
                            </Text>

                        </View>

                    ))}

                </View>

                {/* TOTAL */}
                <View style={styles.totalContainer}>

                    <View style={styles.totalBox}>

                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>
                                Total TTC
                            </Text>

                            <Text style={styles.totalValue}>
                                {order.amount} {currency}
                            </Text>
                        </View>

                    </View>

                </View>

                {/* FOOTER */}
                <View style={styles.footer}>

                    <Text>
                        Merci pour votre confiance chez GreenCart
                    </Text>

                    <Text>
                        Ce document fait office de facture.
                    </Text>

                    <Text>
                        www.greencart.com | contact@greencart.com
                    </Text>

                </View>

            </Page>
        </Document>
    );
};

export default OrderReceiptPDF;