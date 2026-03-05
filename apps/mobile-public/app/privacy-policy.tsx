import { PublicAppChrome } from '../src/components/layout/PublicAppChrome';
import { LegalDocumentView } from '../src/components/legal/LegalDocumentView';

export default function PrivacyPolicyScreen() {
  return (
    <PublicAppChrome>
      {({ onScroll, scrollEventThrottle, contentPaddingStyle }) => (
        <LegalDocumentView
          doc="privacy"
          onScroll={onScroll}
          scrollEventThrottle={scrollEventThrottle}
          contentPaddingStyle={contentPaddingStyle}
        />
      )}
    </PublicAppChrome>
  );
}
