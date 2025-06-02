// Truth-Finding Orchestrator - Coordinates truth-finding agents
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';
import { EvidenceStandards } from './evidence-standards.js';
import { truthFindingAgentConfig } from '../agents/truth-finding-roles.js';

export class TruthFindingOrchestrator {
  constructor(taskManager, unifiedOrchestrator) {
    this.taskManager = taskManager;
    this.unifiedOrchestrator = unifiedOrchestrator;
    this.evidenceStandards = new EvidenceStandards();
    this.activeInvestigations = new Map();
  }

  async init() {
    logger.info('Truth-Finding Orchestrator initialized');
  }

  // Main entry point for truth-finding requests
  async investigateClaim(claim, context = {}) {
    const investigationId = uuidv4();
    const projectId = context.projectId || `truth_investigation_${investigationId}`;
    
    // Store investigation metadata
    const investigation = {
      id: investigationId,
      claim,
      context,
      projectId,
      status: 'initiated',
      startedAt: new Date().toISOString(),
      agents: {
        truthSeeker: null,
        trialByFire: null,
        credibility: null
      },
      results: {
        truthScore: null,
        argumentScore: null,
        credibilityScore: null,
        finalVerdict: null
      }
    };
    
    this.activeInvestigations.set(investigationId, investigation);
    
    // Store in Redis
    await this.taskManager.redis.hSet(`investigation:${investigationId}`, {
      id: investigationId,
      claim: JSON.stringify(claim),
      context: JSON.stringify(context),
      status: 'initiated',
      startedAt: investigation.startedAt
    });
    
    // Start investigation pipeline
    await this.startInvestigationPipeline(investigation);
    
    return investigationId;
  }

  async startInvestigationPipeline(investigation) {
    try {
      // Phase 1: Truth Seeker - Verify primary sources
      const truthSeekerTaskId = await this.unifiedOrchestrator.createAgentTask(
        'truth_seeker',
        'verify_primary_sources',
        {
          investigationId: investigation.id,
          claim: investigation.claim,
          context: investigation.context,
          evidenceStandards: this.evidenceStandards.standards
        }
      );
      
      investigation.agents.truthSeeker = truthSeekerTaskId;
      
      // Phase 2: Trial by Fire - Argue both sides (depends on truth seeker)
      const trialByFireTaskId = await this.unifiedOrchestrator.createAgentTask(
        'trial_by_fire',
        'conduct_adversarial_analysis',
        {
          investigationId: investigation.id,
          claim: investigation.claim,
          truthSeekerTaskId
        },
        [truthSeekerTaskId] // Dependency
      );
      
      investigation.agents.trialByFire = trialByFireTaskId;
      
      // Phase 3: Credibility Agent - Assess sources (runs in parallel)
      const credibilityTaskId = await this.unifiedOrchestrator.createAgentTask(
        'credibility_agent',
        'assess_source_credibility',
        {
          investigationId: investigation.id,
          claim: investigation.claim,
          sources: investigation.context.sources || []
        }
      );
      
      investigation.agents.credibility = credibilityTaskId;
      
      // Phase 4: Final synthesis (depends on all three)
      const synthesisTaskId = await this.unifiedOrchestrator.createAgentTask(
        'truth_seeker', // Use truth seeker for final synthesis
        'synthesize_investigation',
        {
          investigationId: investigation.id,
          truthSeekerTaskId,
          trialByFireTaskId,
          credibilityTaskId
        },
        [truthSeekerTaskId, trialByFireTaskId, credibilityTaskId]
      );
      
      investigation.agents.synthesis = synthesisTaskId;
      
      // Update investigation status
      investigation.status = 'in_progress';
      await this.updateInvestigationStatus(investigation.id, 'in_progress');
      
    } catch (error) {
      logger.error('Investigation pipeline failed:', error);
      investigation.status = 'failed';
      await this.updateInvestigationStatus(investigation.id, 'failed', error.message);
    }
  }

  // Process results from truth-finding agents
  async processAgentResults(investigationId, agentType, results) {
    const investigation = this.activeInvestigations.get(investigationId);
    if (!investigation) {
      logger.error(`Investigation not found: ${investigationId}`);
      return;
    }
    
    try {
      switch (agentType) {
        case 'truth_seeker':
          await this.processTruthSeekerResults(investigation, results);
          break;
          
        case 'trial_by_fire':
          await this.processTrialByFireResults(investigation, results);
          break;
          
        case 'credibility_agent':
          await this.processCredibilityResults(investigation, results);
          break;
          
        default:
          logger.warn(`Unknown agent type in truth investigation: ${agentType}`);
      }
      
      // Check if investigation is complete
      await this.checkInvestigationComplete(investigation);
      
    } catch (error) {
      logger.error(`Error processing ${agentType} results:`, error);
    }
  }

  async processTruthSeekerResults(investigation, results) {
    // Extract truth scores and evidence analysis
    const truthAnalysis = {
      primarySources: results.primarySources || [],
      verificationChain: results.verificationChain || [],
      truthScore: results.truthScore || 0,
      evidenceQuality: results.evidenceQuality || {},
      rejectedClaims: results.rejectedClaims || []
    };
    
    // Validate evidence against legal standards
    const evidenceEvaluation = await this.evaluateEvidence(truthAnalysis.primarySources);
    
    // Store results in Redis
    await this.taskManager.redis.hSet(`investigation:${investigation.id}:truth_analysis`, {
      score: truthAnalysis.truthScore,
      primarySourceCount: truthAnalysis.primarySources.length,
      admissibleEvidence: evidenceEvaluation.admissible,
      evidenceReport: JSON.stringify(evidenceEvaluation),
      analysis: JSON.stringify(truthAnalysis)
    });
    
    investigation.results.truthScore = truthAnalysis.truthScore;
    investigation.results.evidenceReport = evidenceEvaluation;
  }

  async processTrialByFireResults(investigation, results) {
    // Extract argument scores and debate results
    const debateAnalysis = {
      proArguments: results.proArguments || [],
      conArguments: results.conArguments || [],
      proScore: results.proScore || 0,
      conScore: results.conScore || 0,
      winner: results.winner || 'undecided',
      decisiveFactors: results.decisiveFactors || []
    };
    
    // Calculate argument strength differential
    const argumentDifferential = Math.abs(debateAnalysis.proScore - debateAnalysis.conScore);
    const argumentClarity = argumentDifferential > 20 ? 'clear' : 'contested';
    
    // Store results in Redis
    await this.taskManager.redis.hSet(`investigation:${investigation.id}:debate_analysis`, {
      proScore: debateAnalysis.proScore,
      conScore: debateAnalysis.conScore,
      winner: debateAnalysis.winner,
      argumentClarity,
      differential: argumentDifferential,
      analysis: JSON.stringify(debateAnalysis)
    });
    
    investigation.results.argumentScore = Math.max(debateAnalysis.proScore, debateAnalysis.conScore);
    investigation.results.debateWinner = debateAnalysis.winner;
  }

  async processCredibilityResults(investigation, results) {
    // Extract credibility scores and analysis
    const credibilityAnalysis = {
      overallScore: results.credibilityScore || 0,
      authorProfiles: results.authorProfiles || {},
      hypocrisies: results.hypocrisies || [],
      dependencies: results.dependencies || [],
      redFlags: results.redFlags || []
    };
    
    // Calculate credibility impact
    const credibilityImpact = this.calculateCredibilityImpact(credibilityAnalysis);
    
    // Store results in Redis
    await this.taskManager.redis.hSet(`investigation:${investigation.id}:credibility_analysis`, {
      score: credibilityAnalysis.overallScore,
      hypocrisyCount: credibilityAnalysis.hypocrisies.length,
      redFlagCount: credibilityAnalysis.redFlags.length,
      credibilityImpact,
      analysis: JSON.stringify(credibilityAnalysis)
    });
    
    investigation.results.credibilityScore = credibilityAnalysis.overallScore;
    investigation.results.credibilityImpact = credibilityImpact;
  }

  async checkInvestigationComplete(investigation) {
    // Check if all core analyses are complete
    const { truthScore, argumentScore, credibilityScore } = investigation.results;
    
    if (truthScore !== null && argumentScore !== null && credibilityScore !== null) {
      // Calculate final verdict
      const finalVerdict = await this.calculateFinalVerdict(investigation);
      
      investigation.results.finalVerdict = finalVerdict;
      investigation.status = 'completed';
      investigation.completedAt = new Date().toISOString();
      
      // Store final results
      await this.storeFinalResults(investigation);
      
      // Update status
      await this.updateInvestigationStatus(investigation.id, 'completed');
      
      logger.info(`Investigation ${investigation.id} completed with verdict: ${finalVerdict.conclusion}`);
    }
  }

  async calculateFinalVerdict(investigation) {
    const { truthScore, argumentScore, credibilityScore, debateWinner, evidenceReport } = investigation.results;
    
    // Weight the different scores
    const weights = {
      truth: 0.4,      // Primary source verification
      argument: 0.3,   // Adversarial analysis
      credibility: 0.3 // Source reliability
    };
    
    // Calculate weighted score
    const weightedScore = (truthScore * weights.truth) + 
                         (argumentScore * weights.argument) + 
                         (credibilityScore * weights.credibility);
    
    // Determine conclusion based on evidence standards
    let conclusion = 'UNVERIFIED';
    let confidence = 'low';
    let standard = 'none';
    
    if (evidenceReport && evidenceReport.admissible > 0) {
      const evidenceStrength = evidenceReport.admissible / evidenceReport.totalEvidence;
      
      if (weightedScore >= 95 && evidenceStrength >= 0.9) {
        conclusion = 'VERIFIED - Beyond Reasonable Doubt';
        confidence = 'very_high';
        standard = 'beyond_reasonable_doubt';
      } else if (weightedScore >= 75 && evidenceStrength >= 0.75) {
        conclusion = 'LIKELY TRUE - Clear and Convincing';
        confidence = 'high';
        standard = 'clear_and_convincing';
      } else if (weightedScore >= 51 && evidenceStrength >= 0.5) {
        conclusion = 'PROBABLY TRUE - Preponderance of Evidence';
        confidence = 'moderate';
        standard = 'preponderance';
      } else if (weightedScore >= 30) {
        conclusion = 'DISPUTED - Insufficient Evidence';
        confidence = 'low';
        standard = 'insufficient';
      } else {
        conclusion = 'LIKELY FALSE - Evidence Against';
        confidence = 'moderate';
        standard = 'contradicted';
      }
    }
    
    // Special cases
    if (truthScore < 20 && credibilityScore < 30) {
      conclusion = 'FALSE - Unreliable Sources';
      confidence = 'high';
    }
    
    if (debateWinner === 'con' && argumentScore > 80) {
      conclusion = 'REFUTED - Strong Counter-Evidence';
      confidence = 'high';
    }
    
    return {
      conclusion,
      confidence,
      weightedScore: Math.round(weightedScore),
      standard,
      scores: {
        truth: truthScore,
        argument: argumentScore,
        credibility: credibilityScore
      },
      reasoning: this.generateVerdictReasoning(investigation)
    };
  }

  generateVerdictReasoning(investigation) {
    const reasons = [];
    const { truthScore, argumentScore, credibilityScore, evidenceReport } = investigation.results;
    
    // Truth score reasoning
    if (truthScore >= 80) {
      reasons.push('Strong primary source verification');
    } else if (truthScore < 50) {
      reasons.push('Weak or missing primary sources');
    }
    
    // Argument reasoning
    if (investigation.results.debateWinner === 'pro') {
      reasons.push('Arguments favor the claim');
    } else if (investigation.results.debateWinner === 'con') {
      reasons.push('Strong counter-arguments present');
    }
    
    // Credibility reasoning
    if (credibilityScore >= 70) {
      reasons.push('Highly credible sources');
    } else if (credibilityScore < 30) {
      reasons.push('Source credibility issues identified');
    }
    
    // Evidence quality
    if (evidenceReport && evidenceReport.admissible > evidenceReport.inadmissible) {
      reasons.push('Majority of evidence meets legal standards');
    } else {
      reasons.push('Significant inadmissible evidence');
    }
    
    return reasons;
  }

  async evaluateEvidence(sources) {
    const evaluations = [];
    
    for (const source of sources) {
      const evaluation = await this.evidenceStandards.evaluateAdmissibility(source);
      evaluations.push(evaluation);
    }
    
    return this.evidenceStandards.generateEvidenceReport(sources, evaluations);
  }

  calculateCredibilityImpact(analysis) {
    let impact = 'neutral';
    
    if (analysis.overallScore >= 70 && analysis.hypocrisies.length === 0) {
      impact = 'enhances';
    } else if (analysis.overallScore < 30 || analysis.redFlags.length > 3) {
      impact = 'undermines';
    } else if (analysis.hypocrisies.length > 2) {
      impact = 'questions';
    }
    
    return impact;
  }

  async storeFinalResults(investigation) {
    const finalReport = {
      id: investigation.id,
      claim: investigation.claim,
      verdict: investigation.results.finalVerdict,
      scores: {
        truth: investigation.results.truthScore,
        argument: investigation.results.argumentScore,
        credibility: investigation.results.credibilityScore
      },
      evidenceReport: investigation.results.evidenceReport,
      completedAt: investigation.completedAt,
      duration: new Date(investigation.completedAt) - new Date(investigation.startedAt)
    };
    
    // Store complete report
    await this.taskManager.redis.hSet(`investigation:${investigation.id}:final_report`, {
      report: JSON.stringify(finalReport),
      verdict: finalReport.verdict.conclusion,
      confidence: finalReport.verdict.confidence,
      timestamp: investigation.completedAt
    });
    
    // Store in investigation log
    await this.taskManager.redis.lPush('investigation_log', JSON.stringify({
      id: investigation.id,
      claim: investigation.claim.substring(0, 100) + '...',
      verdict: finalReport.verdict.conclusion,
      timestamp: investigation.completedAt
    }));
  }

  async updateInvestigationStatus(investigationId, status, error = null) {
    const update = {
      status,
      updatedAt: new Date().toISOString()
    };
    
    if (error) {
      update.error = error;
    }
    
    await this.taskManager.redis.hSet(`investigation:${investigationId}`, update);
  }

  // Get investigation results
  async getInvestigationResults(investigationId) {
    const investigation = this.activeInvestigations.get(investigationId);
    
    if (!investigation) {
      // Try to load from Redis
      const stored = await this.taskManager.redis.hGetAll(`investigation:${investigationId}`);
      if (!stored || !stored.id) {
        throw new Error(`Investigation not found: ${investigationId}`);
      }
      
      // Load final report if available
      const finalReport = await this.taskManager.redis.hGet(
        `investigation:${investigationId}:final_report`, 
        'report'
      );
      
      if (finalReport) {
        return JSON.parse(finalReport);
      }
      
      return {
        id: investigationId,
        status: stored.status,
        error: stored.error || null
      };
    }
    
    return {
      id: investigation.id,
      claim: investigation.claim,
      status: investigation.status,
      results: investigation.results,
      agents: investigation.agents
    };
  }

  // Get all investigations
  async getAllInvestigations(limit = 10) {
    const logs = await this.taskManager.redis.lRange('investigation_log', 0, limit - 1);
    return logs.map(log => JSON.parse(log));
  }

  // Special investigation types
  async investigatePolitician(name, statements) {
    return this.investigateClaim(
      `Consistency check for ${name}`,
      {
        type: 'politician_check',
        subject: name,
        statements,
        projectId: `politician_${name.replace(/\s+/g, '_').toLowerCase()}`
      }
    );
  }

  async investigateScientificClaim(claim, papers) {
    return this.investigateClaim(
      claim,
      {
        type: 'scientific_claim',
        sources: papers,
        requirePeerReview: true,
        projectId: `science_${Date.now()}`
      }
    );
  }

  async investigateLegalDispute(claim, evidence, jurisdiction) {
    return this.investigateClaim(
      claim,
      {
        type: 'legal_dispute',
        evidence,
        jurisdiction,
        burdenOfProof: 'preponderance',
        projectId: `legal_${Date.now()}`
      }
    );
  }
}