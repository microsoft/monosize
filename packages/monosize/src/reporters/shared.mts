import type { ComparedReport } from '../utils/compareResultsInReports.mjs';

export type Reporter = (
  report: ComparedReport,
  options: { commitSHA: string; repository: string; showUnchanged: boolean },
) => void;
