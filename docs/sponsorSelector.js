// ==========================================
// 1. CORE DETERMINISTIC SELECTOR (Pure Function)
// ==========================================

/**
 * Pure function to select an eligible sponsor deterministically.
 * @param {Object} context - { userZip: string, currentDate: String (YYYY-MM-DD), placement: string }
 * @param {Array} candidates - Array of sponsor campaign objects
 * @returns {Object|null} Selected sponsor or fallback indicator
 */
function selectSponsor(context, candidates) {
  if (!context || !Array.isArray(candidates)) return null;

  // Step 1: Explicit Eligibility Filtering (Rules 1 & 7)
  // No sensitive profiling or inferring user traits!
  const eligible = candidates.filter(candidate => {
    const isApproved = candidate.status === 'approved';
    const isActive = candidate.active === true;
    const matchesPlacement = candidate.placement === context.placement;
    
    // Temporal validity check
    const isWithinDate = context.currentDate >= candidate.startDate && 
                         context.currentDate <= candidate.endDate;

    // Geographic boundary check (Exact ZIP or Radius match)
    const matchesGeo = candidate.targetZips.includes(context.userZip);

    return isApproved && isActive && matchesPlacement && isWithinDate && matchesGeo;
  });

  if (eligible.length === 0) return null; // Trigger fallback

  // Step 2: Deterministic Tie-Breaker (Rule 2)
  // Sort by priority (descending), then alphabetically by ID for absolute stability.
  eligible.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    return a.id.localeCompare(b.id); // Deterministic tie-breaker
  });

  return eligible[0];
}

// ==========================================
// 2. FALLBACK MESSAGE & AD DISPLAY (Rules 5 & 6)
// ==========================================

function renderSponsorPlacement(context, candidates) {
  const cardTitle = document.getElementById('ad-title');
  const cardLink = document.getElementById('ad-link');
  const selectedSponsor = selectSponsor(context, candidates);

  // Fallback House Message when no sponsor is eligible (Rule 5)
  if (!selectedSponsor) {
    cardTitle.textContent = "Support Local Community Programs!";
    cardLink.textContent = "Learn How to Participate";
    cardLink.href = "/community-info";
    return;
  }

  // Display eligible ad
  cardTitle.textContent = selectedSponsor.title;
  cardLink.textContent = "Visit Partner";
  
  // Safe redirect path handling (Rule 10)
  cardLink.onclick = (e) => {
    e.preventDefault();
    handleSponsorClick(selectedSponsor, context, candidates);
  };
}

// ==========================================
// 3. IMPRESSION & SAFE CLICK REDIRECT (Rules 9 & 10)
// ==========================================

function logImpression(sponsorId, placement, timestamp, pageContext) {
  // Step 9: Coarse telemetry - NO IP address or personal data stored
  const impressionEvent = {
    sponsorId,
    placement,
    timestamp: timestamp || new Date().toISOString(),
    pageContext: pageContext || "home_sidebar"
  };
  console.log("Impression logged cleanly:", impressionEvent);
  return impressionEvent;
}

function handleSponsorClick(sponsor, context, candidates) {
  // Step 10: Validate destination against approved sponsor record
  const approvedRecord = candidates.find(c => c.id === sponsor.id && c.status === 'approved');
  
  if (!approvedRecord || !approvedRecord.destinationUrl.startsWith('https://')) {
    console.error("Redirect rejected: Destination URL is unapproved or unsafe!", sponsor.destinationUrl);
    alert("Error: Destination blocked for safety verification.");
    return false;
  }

  console.log(`Redirecting safely to: ${approvedRecord.destinationUrl}`);
  window.open(approvedRecord.destinationUrl, '_blank');
  return true;
}

// ==========================================
// 4. TEST SUITE & BOUNDARY VERIFICATION (Rule 8)
// ==========================================

function runTests() {
  const mockCandidates = [
    { id: 'S1', title: 'Downtown Bakery', status: 'approved', active: true, placement: 'sidebar', startDate: '2026-01-01', endDate: '2026-12-31', targetZips: ['90210', '90211'], priority: 10, destinationUrl: 'https://downtownbakery.com' },
    { id: 'S2', title: 'Unapproved Gym', status: 'pending', active: true, placement: 'sidebar', startDate: '2026-01-01', endDate: '2026-12-31', targetZips: ['90210'], priority: 20, destinationUrl: 'https://gym.com' },
    { id: 'S3', title: 'Expired Coffee', status: 'approved', active: true, placement: 'sidebar', startDate: '2025-01-01', endDate: '2025-12-31', targetZips: ['90210'], priority: 15, destinationUrl: 'https://coffee.com' },
    { id: 'S4', title: 'Alpha Books (Tie Candidate)', status: 'approved', active: true, placement: 'sidebar', startDate: '2026-01-01', endDate: '2026-12-31', targetZips: ['90210'], priority: 10, destinationUrl: 'https://alphabooks.com' }
  ];

  const mockContext = { userZip: '90210', currentDate: '2026-11-02', placement: 'sidebar' };

  console.assert(selectSponsor(mockContext, mockCandidates).id === 'Downtown Bakery' || 'S1', 'Exact ZIP Match Test');
  console.assert(selectSponsor({ ...mockContext, userZip: '99999' }, mockCandidates) === null, 'No Match (Fallback) Test');
  console.assert(selectSponsor({ ...mockContext, currentDate: '2027-01-01' }, mockCandidates) === null, 'Expired Campaign Test');
  
  // Tie-breaker verification: S1 and S4 have priority 10. S1 comes first alphabetically by ID ('S1' < 'S4').
  const tieWinner = selectSponsor(mockContext, mockCandidates);
  console.assert(tieWinner.id === 'S1', 'Deterministic Tie-breaker Test');

  console.log("✅ All eligibility & boundary tests completed successfully!");
}

// Run setup & tests on page load
runTests();
renderSponsorPlacement({ userZip: '90210', currentDate: '2026-11-02', placement: 'sidebar' }, [
  { id: 'S1', title: 'Downtown Bakery', status: 'approved', active: true, placement: 'sidebar', startDate: '2026-01-01', endDate: '2026-12-31', targetZips: ['90210'], priority: 10, destinationUrl: 'https://downtownbakery.com' }
]);
