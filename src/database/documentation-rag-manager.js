import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import logger from '../logger.js';

export class DocumentationRAGManager {
  constructor(taskManager) {
    this.taskManager = taskManager;
    this.redis = taskManager.redis;
  }

  // Documentation Management
  async indexDocumentation(dependency) {
    await this.taskManager.ensureConnection();
    const docId = uuidv4();
    
    const documentation = {
      id: docId,
      dependencyId: dependency.id,
      packageName: dependency.name,
      version: dependency.version,
      type: dependency.type || 'library',
      source: dependency.source || 'npm',
      
      // Core Documentation
      readme: dependency.readme || '',
      apiReference: JSON.stringify(dependency.apiReference || {}),
      examples: JSON.stringify(dependency.examples || []),
      bestPractices: JSON.stringify(dependency.bestPractices || []),
      commonPatterns: JSON.stringify(dependency.commonPatterns || []),
      
      // Integration Information
      setupInstructions: JSON.stringify(dependency.setupInstructions || {}),
      configurationOptions: JSON.stringify(dependency.configurationOptions || {}),
      environmentVariables: JSON.stringify(dependency.environmentVariables || []),
      
      // Compatibility Information
      compatibleVersions: JSON.stringify(dependency.compatibleVersions || {}),
      knownIssues: JSON.stringify(dependency.knownIssues || []),
      breakingChanges: JSON.stringify(dependency.breakingChanges || {}),
      
      // Performance & Security
      performanceConsiderations: JSON.stringify(dependency.performanceConsiderations || []),
      securityGuidelines: JSON.stringify(dependency.securityGuidelines || []),
      vulnerabilities: JSON.stringify(dependency.vulnerabilities || []),
      
      // Metadata
      lastUpdated: new Date().toISOString(),
      indexedAt: new Date().toISOString(),
      indexedBy: dependency.indexedBy || 'system',
      documentationUrl: dependency.documentationUrl || '',
      repositoryUrl: dependency.repositoryUrl || '',
      
      // Search Optimization
      searchableContent: this.createSearchableContent(dependency),
      contentHash: ''
    };
    
    // Generate content hash
    documentation.contentHash = crypto.createHash('sha256')
      .update(documentation.searchableContent)
      .digest('hex');
    
    // Store documentation
    await this.redis.hSet(`documentation:${docId}`, documentation);
    
    // Index by package name and version
    await this.redis.hSet(
      `doc_index:${dependency.name}`,
      dependency.version,
      docId
    );
    
    // Add to searchable content index
    await this.indexSearchableContent(docId, documentation.searchableContent);
    
    // Index for vector search if embeddings provided
    if (dependency.embeddings) {
      await this.indexEmbeddings(docId, dependency.embeddings);
    }
    
    logger.info(`Indexed documentation for ${dependency.name}@${dependency.version}`);
    return docId;
  }

  // RAG Query System
  async queryDocumentation(query, context = {}) {
    await this.taskManager.ensureConnection();
    
    // Search strategies
    const results = await Promise.all([
      this.keywordSearch(query, context),
      this.semanticSearch(query, context),
      this.contextualSearch(query, context)
    ]);
    
    // Merge and rank results
    const mergedResults = this.mergeSearchResults(results);
    
    // Apply context filtering
    const filteredResults = await this.applyContextFilter(mergedResults, context);
    
    // Generate response
    return this.generateRAGResponse(query, filteredResults, context);
  }

  // Documentation Update System
  async updateDocumentation(packageName, version, updates) {
    await this.taskManager.ensureConnection();
    
    // Get existing documentation
    const docId = await this.redis.hGet(`doc_index:${packageName}`, version);
    if (!docId) {
      throw new Error(`Documentation not found for ${packageName}@${version}`);
    }
    
    const existingDoc = await this.redis.hGetAll(`documentation:${docId}`);
    if (!existingDoc) {
      throw new Error(`Documentation ${docId} not found`);
    }
    
    // Merge updates
    const updatedDoc = {
      ...existingDoc,
      ...updates,
      lastUpdated: new Date().toISOString(),
      previousHash: existingDoc.contentHash
    };
    
    // Update searchable content
    updatedDoc.searchableContent = this.createSearchableContent({
      name: packageName,
      version,
      readme: updatedDoc.readme,
      apiReference: JSON.parse(updatedDoc.apiReference || '{}'),
      examples: JSON.parse(updatedDoc.examples || '[]'),
      bestPractices: JSON.parse(updatedDoc.bestPractices || '[]')
    });
    
    // Update content hash
    updatedDoc.contentHash = crypto.createHash('sha256')
      .update(updatedDoc.searchableContent)
      .digest('hex');
    
    // Store updated documentation
    await this.redis.hSet(`documentation:${docId}`, updatedDoc);
    
    // Update search index
    await this.updateSearchIndex(docId, updatedDoc.searchableContent);
    
    // Track documentation changes
    await this.trackDocumentationChange(docId, existingDoc, updatedDoc);
    
    return docId;
  }

  // Compatibility Documentation
  async documentCompatibility(projectId, dependency, compatibilityReport) {
    await this.taskManager.ensureConnection();
    const compatId = uuidv4();
    
    const compatDoc = {
      id: compatId,
      projectId,
      dependencyId: dependency.id,
      packageName: dependency.name,
      version: dependency.version,
      
      // Compatibility Status
      overallStatus: compatibilityReport.status,
      compatibilityScore: compatibilityReport.score || 0,
      
      // Detailed Compatibility
      compatiblePackages: JSON.stringify(compatibilityReport.compatible || []),
      incompatiblePackages: JSON.stringify(compatibilityReport.incompatible || []),
      conditionallyCompatible: JSON.stringify(compatibilityReport.conditional || []),
      
      // Issues and Resolutions
      issues: JSON.stringify(compatibilityReport.issues || []),
      resolutions: JSON.stringify(compatibilityReport.resolutions || []),
      workarounds: JSON.stringify(compatibilityReport.workarounds || []),
      
      // Version Constraints
      versionConstraints: JSON.stringify(compatibilityReport.constraints || {}),
      recommendedVersions: JSON.stringify(compatibilityReport.recommended || {}),
      
      // Migration Information
      migrationRequired: compatibilityReport.migrationRequired || false,
      migrationSteps: JSON.stringify(compatibilityReport.migrationSteps || []),
      estimatedMigrationEffort: compatibilityReport.migrationEffort || 0,
      
      // Metadata
      analyzedAt: new Date().toISOString(),
      analyzedBy: compatibilityReport.analyzedBy || 'system',
      validUntil: compatibilityReport.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    // Store compatibility documentation
    await this.redis.hSet(`compat_doc:${compatId}`, compatDoc);
    
    // Index by project and dependency
    await this.redis.hSet(
      `project:${projectId}:compat_docs`,
      `${dependency.name}:${dependency.version}`,
      compatId
    );
    
    // Add to compatibility index
    if (compatibilityReport.status === 'incompatible') {
      await this.redis.sAdd(`incompatible:${projectId}`, dependency.id);
    }
    
    return compatId;
  }

  // Feature Documentation
  async documentFeature(projectId, featureId, documentation) {
    await this.taskManager.ensureConnection();
    const featureDocId = uuidv4();
    
    const featureDoc = {
      id: featureDocId,
      projectId,
      featureId,
      
      // Core Documentation
      title: documentation.title,
      description: documentation.description,
      purpose: documentation.purpose || '',
      scope: JSON.stringify(documentation.scope || []),
      
      // Technical Documentation
      architecture: JSON.stringify(documentation.architecture || {}),
      apiEndpoints: JSON.stringify(documentation.apiEndpoints || []),
      dataModels: JSON.stringify(documentation.dataModels || {}),
      dependencies: JSON.stringify(documentation.dependencies || []),
      
      // Usage Documentation
      userGuide: documentation.userGuide || '',
      apiReference: JSON.stringify(documentation.apiReference || {}),
      examples: JSON.stringify(documentation.examples || []),
      tutorials: JSON.stringify(documentation.tutorials || []),
      
      // Testing Documentation
      testingStrategy: documentation.testingStrategy || '',
      testCases: JSON.stringify(documentation.testCases || []),
      testCoverage: documentation.testCoverage || 0,
      
      // Deployment Documentation
      deploymentGuide: documentation.deploymentGuide || '',
      configuration: JSON.stringify(documentation.configuration || {}),
      monitoring: JSON.stringify(documentation.monitoring || {}),
      
      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: documentation.version || '1.0.0',
      status: documentation.status || 'draft'
    };
    
    // Store feature documentation
    await this.redis.hSet(`feature_doc:${featureDocId}`, featureDoc);
    
    // Index by project and feature
    await this.redis.hSet(
      `project:${projectId}:feature_docs`,
      featureId,
      featureDocId
    );
    
    // Add to searchable index
    const searchableContent = this.createFeatureSearchableContent(featureDoc);
    await this.indexSearchableContent(featureDocId, searchableContent);
    
    return featureDocId;
  }

  // Helper Methods
  createSearchableContent(dependency) {
    const parts = [
      dependency.name,
      dependency.version,
      dependency.readme || '',
      JSON.stringify(dependency.apiReference || {}),
      JSON.stringify(dependency.examples || []),
      JSON.stringify(dependency.bestPractices || [])
    ];
    
    return parts.join(' ').toLowerCase();
  }

  createFeatureSearchableContent(featureDoc) {
    const parts = [
      featureDoc.title,
      featureDoc.description,
      featureDoc.purpose,
      featureDoc.userGuide,
      JSON.stringify(JSON.parse(featureDoc.apiEndpoints || '[]')),
      JSON.stringify(JSON.parse(featureDoc.examples || '[]'))
    ];
    
    return parts.join(' ').toLowerCase();
  }

  async indexSearchableContent(docId, content) {
    // Simple inverted index for keyword search
    const words = content.split(/\s+/).filter(w => w.length > 2);
    
    for (const word of words) {
      await this.redis.sAdd(`search_index:${word}`, docId);
    }
    
    // Store full content for retrieval
    await this.redis.hSet(`search_content:${docId}`, 'content', content);
  }

  async updateSearchIndex(docId, newContent) {
    // Remove old index entries
    const oldContent = await this.redis.hGet(`search_content:${docId}`, 'content');
    if (oldContent) {
      const oldWords = oldContent.split(/\s+/).filter(w => w.length > 2);
      for (const word of oldWords) {
        await this.redis.sRem(`search_index:${word}`, docId);
      }
    }
    
    // Add new index entries
    await this.indexSearchableContent(docId, newContent);
  }

  async indexEmbeddings(docId, embeddings) {
    // Store embeddings for vector search
    for (const [key, embedding] of Object.entries(embeddings)) {
      await this.redis.hSet(
        `embeddings:${docId}`,
        key,
        JSON.stringify(embedding)
      );
    }
  }

  async keywordSearch(query, context) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const docIds = new Set();
    
    for (const word of words) {
      const ids = await this.redis.sMembers(`search_index:${word}`);
      ids.forEach(id => docIds.add(id));
    }
    
    return Array.from(docIds);
  }

  async semanticSearch(query, context) {
    // Placeholder for semantic search implementation
    // Would use embeddings and vector similarity
    return [];
  }

  async contextualSearch(query, context) {
    const results = [];
    
    if (context.projectId) {
      // Search project-specific documentation
      const featureDocs = await this.redis.hGetAll(`project:${context.projectId}:feature_docs`);
      const compatDocs = await this.redis.hGetAll(`project:${context.projectId}:compat_docs`);
      
      results.push(...Object.values(featureDocs));
      results.push(...Object.values(compatDocs));
    }
    
    if (context.dependencies) {
      // Search dependency-specific documentation
      for (const dep of context.dependencies) {
        const docId = await this.redis.hGet(`doc_index:${dep.name}`, dep.version);
        if (docId) results.push(docId);
      }
    }
    
    return results;
  }

  mergeSearchResults(results) {
    const [keyword, semantic, contextual] = results;
    const merged = new Map();
    
    // Score based on appearance in multiple search types
    const addToMerged = (docId, score) => {
      if (merged.has(docId)) {
        merged.set(docId, merged.get(docId) + score);
      } else {
        merged.set(docId, score);
      }
    };
    
    keyword.forEach(id => addToMerged(id, 3));
    semantic.forEach(id => addToMerged(id, 2));
    contextual.forEach(id => addToMerged(id, 1));
    
    // Sort by score
    return Array.from(merged.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  }

  async applyContextFilter(docIds, context) {
    const filtered = [];
    
    for (const docId of docIds) {
      const doc = await this.redis.hGetAll(`documentation:${docId}`) ||
                  await this.redis.hGetAll(`feature_doc:${docId}`) ||
                  await this.redis.hGetAll(`compat_doc:${docId}`);
      
      if (!doc) continue;
      
      // Apply filters based on context
      if (context.type && doc.type !== context.type) continue;
      if (context.minVersion && doc.version < context.minVersion) continue;
      if (context.excludeDeprecated && doc.deprecationStatus === 'deprecated') continue;
      
      filtered.push({ id: docId, doc });
    }
    
    return filtered;
  }

  async generateRAGResponse(query, results, context) {
    const response = {
      query,
      context,
      results: [],
      summary: '',
      suggestions: []
    };
    
    // Format results
    for (const { id, doc } of results.slice(0, 5)) {
      response.results.push({
        id,
        type: doc.type || 'documentation',
        title: doc.title || doc.packageName || 'Documentation',
        relevance: 'high',
        content: this.extractRelevantContent(doc, query)
      });
    }
    
    // Generate summary
    response.summary = `Found ${results.length} relevant documentation entries for "${query}"`;
    
    // Generate suggestions
    if (results.length === 0) {
      response.suggestions = [
        'Try using different keywords',
        'Check if the dependency is properly indexed',
        'Ensure the context filters are not too restrictive'
      ];
    }
    
    return response;
  }

  extractRelevantContent(doc, query) {
    // Extract most relevant parts of documentation
    const sections = [];
    
    if (doc.description) {
      sections.push({ type: 'description', content: doc.description });
    }
    
    if (doc.bestPractices) {
      const practices = JSON.parse(doc.bestPractices || '[]');
      if (practices.length > 0) {
        sections.push({ type: 'bestPractices', content: practices });
      }
    }
    
    if (doc.examples) {
      const examples = JSON.parse(doc.examples || '[]');
      if (examples.length > 0) {
        sections.push({ type: 'examples', content: examples });
      }
    }
    
    return sections;
  }

  async trackDocumentationChange(docId, oldDoc, newDoc) {
    const changeId = uuidv4();
    
    await this.redis.hSet(`doc_change:${changeId}`, {
      id: changeId,
      docId,
      packageName: newDoc.packageName,
      version: newDoc.version,
      changeType: 'update',
      changedAt: new Date().toISOString(),
      changedBy: newDoc.indexedBy || 'system',
      previousHash: oldDoc.contentHash,
      newHash: newDoc.contentHash
    });
    
    // Add to change history
    await this.redis.lPush(`doc:${docId}:changes`, changeId);
  }

  // Auto Documentation Updates
  async checkDocumentationUpdates(projectId) {
    await this.taskManager.ensureConnection();
    
    const dependencies = await this.taskManager.dependencies.getProjectDependencies(projectId);
    const updateNeeded = [];
    
    for (const dep of dependencies) {
      const docId = await this.redis.hGet(`doc_index:${dep.name}`, dep.version);
      if (!docId) {
        updateNeeded.push({
          type: 'missing',
          dependency: dep
        });
        continue;
      }
      
      const doc = await this.redis.hGetAll(`documentation:${docId}`);
      const lastUpdated = new Date(doc.lastUpdated);
      const daysSinceUpdate = (Date.now() - lastUpdated) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate > 30) {
        updateNeeded.push({
          type: 'outdated',
          dependency: dep,
          lastUpdated: doc.lastUpdated
        });
      }
    }
    
    return updateNeeded;
  }
}