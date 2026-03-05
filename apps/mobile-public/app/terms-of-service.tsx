import { PublicAppChrome } from '../src/components/layout/PublicAppChrome';
import { LegalDocumentView } from '../src/components/legal/LegalDocumentView';

export default function TermsOfServiceScreen() {
  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <LegalDocumentView
          doc="terms"
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          contentPaddingStyle={contentPaddingStyle}
        />
      )}
    </PublicAppChrome>
  );
}
