import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';

const OrderReceiptPDF = () => {
    console.log("✅ PDF minimal généré");
    
    return (
        <Document>
            <Page>
                <View style={{ padding: 30 }}>
                    <Text>TEST PDF</Text>
                    <Text>Le PDF fonctionne correctement</Text>
                </View>
            </Page>
        </Document>
    );
};

export default OrderReceiptPDF;