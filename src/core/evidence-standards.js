// Legal Evidence Standards for Truth-Finding System
import logger from '../logger.js';

export class EvidenceStandards {
  constructor() {
    // Federal Rules of Evidence based standards
    this.standards = {
      relevance: {
        test: 'Evidence must make a fact more or less probable',
        threshold: 0.1, // Any tendency to prove/disprove
        exceptions: ['prejudicial', 'confusing', 'misleading']
      },
      
      hearsay: {
        definition: 'Out-of-court statement offered for truth of matter asserted',
        prohibited: true,
        exceptions: [
          'present_sense_impression',
          'excited_utterance', 
          'recorded_recollection',
          'business_records',
          'public_records',
          'learned_treatises',
          'ancient_documents',
          'market_reports',
          'reputation_evidence'
        ]
      },
      
      authentication: {
        requirement: 'Sufficient evidence that item is what proponent claims',
        methods: [
          'witness_knowledge',
          'distinctive_characteristics',
          'chain_of_custody',
          'process_or_system',
          'public_records_seal'
        ]
      },
      
      best_evidence: {
        rule: 'Original document required to prove content',
        exceptions: [
          'original_lost_destroyed',
          'original_unobtainable',
          'original_in_opponents_control',
          'collateral_matters'
        ]
      },
      
      expert_testimony: {
        daubert_factors: [
          'testing_capability',
          'peer_review',
          'error_rate',
          'standards_controls',
          'general_acceptance'
        ],
        requirements: {
          qualifications: 'Knowledge, skill, experience, training, or education',
          reliability: 'Based on sufficient facts and reliable methods',
          application: 'Reliably applied to facts of case'
        }
      }
    };
    
    // Burden of proof levels
    this.burdenOfProof = {
      scintilla: { threshold: 0.1, description: 'Slightest evidence' },
      preponderance: { threshold: 0.51, description: 'More likely than not' },
      clear_and_convincing: { threshold: 0.75, description: 'Highly probable' },
      beyond_reasonable_doubt: { threshold: 0.95, description: 'No reasonable doubt' }
    };
  }

  // Evaluate evidence admissibility
  async evaluateAdmissibility(evidence) {
    const evaluation = {
      admissible: true,
      issues: [],
      score: 100,
      analysis: {}
    };
    
    try {
      // Check relevance
      const relevanceCheck = this.checkRelevance(evidence);
      if (!relevanceCheck.passed) {
        evaluation.issues.push(`Relevance: ${relevanceCheck.reason}`);
        evaluation.score -= 25;
      }
      evaluation.analysis.relevance = relevanceCheck;
      
      // Check for hearsay
      const hearsayCheck = this.checkHearsay(evidence);
      if (hearsayCheck.isHearsay && !hearsayCheck.exception) {
        evaluation.admissible = false;
        evaluation.issues.push('Inadmissible hearsay');
        evaluation.score -= 50;
      }
      evaluation.analysis.hearsay = hearsayCheck;
      
      // Check authentication
      const authCheck = this.checkAuthentication(evidence);
      if (!authCheck.authenticated) {
        evaluation.issues.push(`Authentication: ${authCheck.reason}`);
        evaluation.score -= 30;
      }
      evaluation.analysis.authentication = authCheck;
      
      // Check best evidence rule
      const bestEvidenceCheck = this.checkBestEvidence(evidence);
      if (!bestEvidenceCheck.compliant) {
        evaluation.issues.push(`Best Evidence: ${bestEvidenceCheck.reason}`);
        evaluation.score -= 20;
      }
      evaluation.analysis.bestEvidence = bestEvidenceCheck;
      
      // Final admissibility determination
      if (evaluation.score < 50) {
        evaluation.admissible = false;
      }
      
    } catch (error) {
      logger.error('Evidence evaluation error:', error);
      evaluation.admissible = false;
      evaluation.issues.push('Evaluation error');
    }
    
    return evaluation;
  }

  // Check relevance under FRE 401-403
  checkRelevance(evidence) {
    const check = {
      passed: true,
      probativeValue: 0,
      reason: null
    };
    
    // Assess probative value
    if (!evidence.claim || !evidence.fact) {
      check.passed = false;
      check.reason = 'No clear connection to claim';
      return check;
    }
    
    // Check for unfair prejudice (FRE 403)
    if (evidence.prejudicial && evidence.prejudicial > evidence.probative) {
      check.passed = false;
      check.reason = 'Unfair prejudice outweighs probative value';
    }
    
    // Check for confusion or misleading
    if (evidence.confusing || evidence.misleading) {
      check.passed = false;
      check.reason = 'Risk of confusion or misleading';
    }
    
    check.probativeValue = evidence.probative || 0.5;
    return check;
  }

  // Check for hearsay under FRE 801-807
  checkHearsay(evidence) {
    const check = {
      isHearsay: false,
      exception: null,
      analysis: []
    };
    
    // Is it an out-of-court statement?
    if (evidence.type === 'statement' && evidence.outOfCourt) {
      // Is it offered for truth of matter asserted?
      if (evidence.offeredForTruth) {
        check.isHearsay = true;
        
        // Check exceptions
        for (const exception of this.standards.hearsay.exceptions) {
          if (this.qualifiesForException(evidence, exception)) {
            check.exception = exception;
            check.analysis.push(`Qualifies for ${exception} exception`);
            break;
          }
        }
      } else {
        check.analysis.push('Not offered for truth - not hearsay');
      }
    }
    
    return check;
  }

  // Check authentication under FRE 901-903
  checkAuthentication(evidence) {
    const check = {
      authenticated: false,
      method: null,
      chainOfCustody: []
    };
    
    // Check authentication methods
    if (evidence.witness && evidence.witness.firsthandKnowledge) {
      check.authenticated = true;
      check.method = 'witness_knowledge';
    } else if (evidence.distinctiveCharacteristics) {
      check.authenticated = true;
      check.method = 'distinctive_characteristics';
    } else if (evidence.chainOfCustody && evidence.chainOfCustody.length > 0) {
      check.authenticated = true;
      check.method = 'chain_of_custody';
      check.chainOfCustody = evidence.chainOfCustody;
    } else if (evidence.officialSeal || evidence.publicRecord) {
      check.authenticated = true;
      check.method = 'public_records_seal';
    }
    
    if (!check.authenticated) {
      check.reason = 'Insufficient authentication evidence';
    }
    
    return check;
  }

  // Check best evidence rule under FRE 1001-1008
  checkBestEvidence(evidence) {
    const check = {
      compliant: true,
      reason: null
    };
    
    // Does best evidence rule apply?
    if (evidence.type === 'document' || evidence.type === 'recording') {
      if (!evidence.isOriginal) {
        // Check exceptions
        if (evidence.originalLost || evidence.originalDestroyed) {
          check.reason = 'Original lost/destroyed exception applies';
        } else if (evidence.originalUnobtainable) {
          check.reason = 'Original unobtainable exception applies';
        } else if (evidence.collateralMatter) {
          check.reason = 'Collateral matter exception applies';
        } else {
          check.compliant = false;
          check.reason = 'Copy provided without valid exception';
        }
      }
    }
    
    return check;
  }

  // Check expert testimony under Daubert standard
  checkExpertTestimony(expert, testimony) {
    const evaluation = {
      qualified: false,
      reliable: false,
      applicable: false,
      daubertScore: 0,
      issues: []
    };
    
    // Check qualifications
    if (expert.credentials && 
        (expert.education || expert.experience || expert.training)) {
      evaluation.qualified = true;
      evaluation.daubertScore += 20;
    } else {
      evaluation.issues.push('Insufficient qualifications');
    }
    
    // Check Daubert factors
    const daubertFactors = {
      tested: testimony.methodology && testimony.methodology.tested,
      peerReviewed: testimony.peerReviewed,
      errorRate: testimony.errorRate !== undefined,
      standards: testimony.standards && testimony.standards.length > 0,
      generalAcceptance: testimony.generalAcceptance
    };
    
    let daubertMet = 0;
    for (const [factor, met] of Object.entries(daubertFactors)) {
      if (met) {
        daubertMet++;
        evaluation.daubertScore += 16; // 80 points total for 5 factors
      }
    }
    
    if (daubertMet >= 3) {
      evaluation.reliable = true;
    } else {
      evaluation.issues.push(`Only ${daubertMet}/5 Daubert factors met`);
    }
    
    // Check application to facts
    if (testimony.factsConsidered && testimony.methodology) {
      evaluation.applicable = true;
    } else {
      evaluation.issues.push('Methodology not properly applied to facts');
    }
    
    return evaluation;
  }

  // Helper to check hearsay exceptions
  qualifiesForException(evidence, exception) {
    switch (exception) {
      case 'business_records':
        return evidence.businessRecord && 
               evidence.regularCourse && 
               evidence.contemporaneous;
               
      case 'public_records':
        return evidence.publicRecord && 
               evidence.officialDuty;
               
      case 'learned_treatises':
        return evidence.scholarlyWork && 
               evidence.peerReviewed && 
               evidence.recognized;
               
      case 'ancient_documents':
        return evidence.age && evidence.age >= 20 && 
               evidence.authentic;
               
      default:
        return false;
    }
  }

  // Calculate burden of proof satisfaction
  calculateBurdenSatisfaction(evidence, standard = 'preponderance') {
    const burden = this.burdenOfProof[standard];
    if (!burden) {
      throw new Error(`Unknown burden of proof standard: ${standard}`);
    }
    
    let totalWeight = 0;
    let evidenceScore = 0;
    
    // Weight evidence based on admissibility and strength
    for (const item of evidence) {
      const admissibility = item.admissibilityScore || 0.5;
      const strength = item.strengthScore || 0.5;
      const weight = item.weight || 1;
      
      evidenceScore += (admissibility * strength * weight);
      totalWeight += weight;
    }
    
    const satisfaction = totalWeight > 0 ? evidenceScore / totalWeight : 0;
    
    return {
      standard,
      threshold: burden.threshold,
      satisfaction,
      met: satisfaction >= burden.threshold,
      description: burden.description,
      confidence: Math.min(satisfaction / burden.threshold, 1.0)
    };
  }

  // Generate evidence report
  generateEvidenceReport(evidence, evaluations) {
    const report = {
      totalEvidence: evidence.length,
      admissible: 0,
      inadmissible: 0,
      hearsay: 0,
      authenticated: 0,
      issues: [],
      recommendations: []
    };
    
    for (let i = 0; i < evidence.length; i++) {
      const eval = evaluations[i];
      
      if (eval.admissible) {
        report.admissible++;
      } else {
        report.inadmissible++;
        report.issues.push({
          evidence: evidence[i].id || i,
          problems: eval.issues
        });
      }
      
      if (eval.analysis.hearsay && eval.analysis.hearsay.isHearsay) {
        report.hearsay++;
      }
      
      if (eval.analysis.authentication && eval.analysis.authentication.authenticated) {
        report.authenticated++;
      }
    }
    
    // Generate recommendations
    if (report.inadmissible > 0) {
      report.recommendations.push('Obtain primary sources for inadmissible evidence');
    }
    
    if (report.hearsay > report.admissible * 0.5) {
      report.recommendations.push('Too much reliance on hearsay - seek direct evidence');
    }
    
    if (report.authenticated < report.admissible) {
      report.recommendations.push('Improve authentication for remaining evidence');
    }
    
    return report;
  }
}