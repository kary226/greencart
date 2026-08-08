import React, { Suspense, lazy } from 'react';
import { FileText } from 'lucide-react';

// Même raison qu'pour ReceiptDownloadButton.jsx : @react-pdf/renderer est
// lourd, on ne le charge que quand ce bouton est effectivement affiché.
const PDFDownloadLink = lazy(() =>
  import('@react-pdf/renderer').then((mod) => ({ default: mod.PDFDownloadLink }))
);
const ColisSheinReceiptPDF = lazy(() => import('./ColisSheinReceiptPDF'));

const FallbackButton = () => (
  <span className="inline-flex items-center gap-1.5 bg-gray-900 text-white rounded-full px-4 py-2 text-[12.5px] font-medium opacity-70">
    <FileText size={13} /> Préparation…
  </span>
);

const ColisSheinReceiptButton = ({ colis }) => {
  return (
    <Suspense fallback={<FallbackButton />}>
      <PDFDownloadLink
        document={<ColisSheinReceiptPDF colis={colis} />}
        fileName={`recu_${colis.numeroSuivi}.pdf`}
        className="inline-flex items-center gap-1.5 bg-gray-900 text-white rounded-full px-4 py-2 text-[12.5px] font-medium hover:opacity-90 transition no-underline"
      >
        {({ loading: pdfLoading }) =>
          pdfLoading ? 'Préparation…' : (<><FileText size={13} /> Télécharger le reçu</>)
        }
      </PDFDownloadLink>
    </Suspense>
  );
};

export default ColisSheinReceiptButton;