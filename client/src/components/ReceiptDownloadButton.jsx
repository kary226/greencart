import React, { Suspense, lazy } from 'react';
import { FileText } from 'lucide-react';

// ⚡ PHASE 1 - @react-pdf/renderer est une librairie lourde (mise en page PDF
// complète) qui n'est utile qu'au moment où un client télécharge sa facture
// (une action minoritaire). L'importer statiquement dans MyOrders.jsx la
// faisait charger par TOUS les visiteurs dès le premier chargement de la
// page. On la déplace ici, dans un chunk chargé uniquement quand ce bouton
// est effectivement affiché (commande livrée) et monté à l'écran.
const PDFDownloadLink = lazy(() =>
  import('@react-pdf/renderer').then((mod) => ({ default: mod.PDFDownloadLink }))
);
const OrderReceiptPDF = lazy(() => import('./OrderReceiptPDF'));

const FallbackButton = () => (
  <span className="inline-flex items-center gap-1.5 bg-gray-900 text-white rounded-full px-4 py-2 text-[12.5px] font-medium opacity-70">
    <FileText size={13} /> Préparation…
  </span>
);

const ReceiptDownloadButton = ({ order, currency }) => {
  return (
    <Suspense fallback={<FallbackButton />}>
      <PDFDownloadLink
        document={<OrderReceiptPDF order={order} currency={currency} />}
        fileName={`facture_${order._id.slice(-8)}.pdf`}
        className="inline-flex items-center gap-1.5 bg-gray-900 text-white rounded-full px-4 py-2 text-[12.5px] font-medium hover:opacity-90 transition no-underline"
      >
        {({ loading: pdfLoading }) =>
          pdfLoading ? 'Préparation…' : (<><FileText size={13} /> Voir facture</>)
        }
      </PDFDownloadLink>
    </Suspense>
  );
};

export default ReceiptDownloadButton;