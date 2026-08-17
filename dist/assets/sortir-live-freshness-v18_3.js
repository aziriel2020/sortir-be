(()=>{
  'use strict';
  // SORTIR.BE V18.3.1 emergency hotfix.
  // V18.3 used a MutationObserver that mutated the same DOM it observed,
  // which could create an infinite mutation loop and freeze the page.
  // Fresh/stale state is already handled by the React app + /api/live.
  document.documentElement.dataset.sortirFreshnessHotfix='18.3.1';
})();
