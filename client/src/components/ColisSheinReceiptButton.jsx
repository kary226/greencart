import React, { Suspense, lazy } from 'react';
import { FileText } from 'lucide-react';

// Même raison qu'pour ReceiptDownloadButton.jsx : @react-pdf/renderer est
// lourd, on ne le charge que quand ce bouton est effectivement affiché.
const PDFDownloadLink = lazy(() =>
  import('@react-pdf/renderer').then((mod) => ({ default: mod.PDFDownloadLink }))
);
const ColisSheinReceiptPDF = lazy(() => import('./ColisSheinReceiptPDF'));

const FallbackButton = () => (
  <span className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold opacity-70" style={{ background: 'var(--color-ramses-600)', color: '#fff' }}>
    <FileText size={14} /> Préparation…
  </span>
);

const ColisSheinReceiptButton = ({ colis }) => {
  return (
    <Suspense fallback={<FallbackButton />}>
      <PDFDownloadLink
        document={<ColisSheinReceiptPDF colis={colis} />}
        fileName={`recu_${colis.numeroSuivi}.pdf`}
        className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold hover:opacity-90 transition no-underline whitespace-nowrap"
        style={{ background: 'var(--color-ramses-600)', color: '#fff' }}
      >
        {({ loading: pdfLoading }) =>
          pdfLoading ? 'Préparation…' : (<><FileText size={14} /> Télécharger le reçu</>)
        }
      </PDFDownloadLink>
    </Suspense>
  );
};

export default ColisSheinReceiptButton;