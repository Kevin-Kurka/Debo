import fs from 'fs/promises';
import path from 'path';
import Ajv from 'ajv';
import logger from '../../logger.js';

export class AgentTemplateManager {
  constructor() {
    this.templatesDir = path.join(process.cwd(), 'src', 'templates', 'agent-templates');
    this.templates = new Map();
    this.templatesByCategory = new Map();
    this.validator = new Ajv({ allErrors: true });
    this.schema = null;
  }

  async init() {
    // Load validation schema
    await this.loadSchema();
    
    // Load all templates
    await this.loadTemplates();
    
    logger.info(`Agent Template Manager initialized with ${this.templates.size} templates`);
  }

  /**
   * Load the JSON schema for template validation
   */
  async loadSchema() {
    try {
      const schemaPath = path.join(this.templatesDir, 'template-schema.json');
      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      this.schema = JSON.parse(schemaContent);
      this.validateTemplate = this.validator.compile(this.schema);
    } catch (error) {
      logger.error('Failed to load template schema:', error);
      throw error;
    }
  }

  /**
   * Load all agent templates from the templates directory
   */
  async loadTemplates() {
    try {
      const files = await fs.readdir(this.templatesDir);
      const templateFiles = files.filter(file => 
        file.endsWith('.json') && file !== 'template-schema.json' && file !== 'template-manager.js'
      );

      for (const file of templateFiles) {
        await this.loadTemplate(file);
      }

      logger.info(`Loaded ${this.templates.size} agent templates`);
    } catch (error) {
      logger.error('Failed to load templates:', error);
      throw error;
    }
  }

  /**
   * Load a single template file
   */
  async loadTemplate(filename) {
    try {
      const filePath = path.join(this.templatesDir, filename);
      const content = await fs.readFile(filePath, 'utf8');
      const template = JSON.parse(content);

      // Validate template against schema
      const validationResult = this.validateTemplateStructure(template);
      if (!validationResult.valid) {
        logger.warn(`Template ${filename} failed validation:`, validationResult.errors);
        return false;
      }

      // Store template
      this.templates.set(template.name, {
        ...template,
        filename,
        loadedAt: new Date().toISOString()
      });

      // Index by category
      const category = template.category || 'custom';
      if (!this.templatesByCategory.has(category)) {
        this.templatesByCategory.set(category, []);
      }
      this.templatesByCategory.get(category).push(template.name);

      logger.debug(`Loaded template: ${template.name} (${template.displayName})`);
      return true;

    } catch (error) {
      logger.error(`Failed to load template ${filename}:`, error);
      return false;
    }
  }

  /**
   * Get a template by name
   */
  getTemplate(name) {
    return this.templates.get(name);
  }

  /**
   * Get all templates
   */
  getAllTemplates() {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category) {
    const templateNames = this.templatesByCategory.get(category) || [];
    return templateNames.map(name => this.templates.get(name));
  }

  /**
   * Get available categories
   */
  getCategories() {
    return Array.from(this.templatesByCategory.keys());
  }

  /**
   * Search templates by keywords
   */
  searchTemplates(query, options = {}) {
    const {
      category = null,
      llmType = null,
      capabilities = [],
      tags = []
    } = options;

    const results = [];
    const queryLower = query.toLowerCase();

    for (const template of this.templates.values()) {
      let score = 0;

      // Category filter
      if (category && template.category !== category) continue;

      // LLM type filter
      if (llmType && template.llmType !== llmType) continue;

      // Capabilities filter
      if (capabilities.length > 0) {
        const hasCapabilities = capabilities.every(cap => 
          template.capabilities.includes(cap)
        );
        if (!hasCapabilities) continue;
      }

      // Tags filter
      if (tags.length > 0 && template.tags) {
        const hasTags = tags.some(tag => template.tags.includes(tag));
        if (!hasTags) continue;
      }

      // Text search scoring
      if (template.name.toLowerCase().includes(queryLower)) score += 10;
      if (template.displayName.toLowerCase().includes(queryLower)) score += 8;
      if (template.description.toLowerCase().includes(queryLower)) score += 5;
      
      // Capability matching
      for (const capability of template.capabilities) {
        if (capability.toLowerCase().includes(queryLower)) score += 3;
      }

      // Tag matching
      if (template.tags) {
        for (const tag of template.tags) {
          if (tag.toLowerCase().includes(queryLower)) score += 2;
        }
      }

      if (score > 0) {
        results.push({ template, score });
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    return results.map(result => result.template);
  }

  /**
   * Create a new agent configuration from a template
   */
  instantiateTemplate(templateName, customizations = {}) {
    const template = this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    // Deep clone template to avoid mutations
    const instance = JSON.parse(JSON.stringify(template));

    // Apply customizations
    if (customizations.name) {
      instance.name = customizations.name;
    }

    if (customizations.displayName) {
      instance.displayName = customizations.displayName;
    }

    if (customizations.description) {
      instance.description = customizations.description;
    }

    // Merge configuration
    if (customizations.configuration) {
      instance.configuration = {
        ...instance.configuration,
        ...customizations.configuration
      };
    }

    // Override resource requirements
    if (customizations.resourceRequirements) {
      instance.resourceRequirements = {
        ...instance.resourceRequirements,
        ...customizations.resourceRequirements
      };
    }

    // Add custom capabilities
    if (customizations.additionalCapabilities) {
      instance.capabilities = [
        ...instance.capabilities,
        ...customizations.additionalCapabilities
      ];
    }

    // Add custom dependencies
    if (customizations.additionalDependencies) {
      instance.dependencies = [
        ...(instance.dependencies || []),
        ...customizations.additionalDependencies
      ];
    }

    // Add metadata
    instance.instantiatedAt = new Date().toISOString();
    instance.templateSource = templateName;
    instance.customizations = Object.keys(customizations);

    return instance;
  }

  /**
   * Validate template structure against schema
   */
  validateTemplateStructure(template) {
    if (!this.validateTemplate) {
      return { valid: false, errors: ['Schema not loaded'] };
    }

    const valid = this.validateTemplate(template);
    const errors = valid ? [] : this.validateTemplate.errors.map(error => 
      `${error.instancePath}: ${error.message}`
    );

    return { valid, errors };
  }

  /**
   * Validate template for practical usage
   */
  validateTemplateUsability(template) {
    const issues = [];

    // Check instruction quality
    if (template.instructions.length < 200) {
      issues.push('Instructions are too brief for effective agent operation');
    }

    // Check capability coverage
    if (template.capabilities.length === 0) {
      issues.push('No capabilities defined');
    }

    // Check deliverables completeness
    if (!template.deliverables.database || template.deliverables.database.length === 0) {
      issues.push('No database deliverables defined');
    }

    if (!template.deliverables.outputs || template.deliverables.outputs.length === 0) {
      issues.push('No output deliverables defined');
    }

    // Check for proper LLM type assignment
    const complexCapabilities = ['analysis', 'research', 'planning', 'strategy'];
    const hasComplexCapabilities = template.capabilities.some(cap => 
      complexCapabilities.some(complex => cap.includes(complex))
    );

    if (hasComplexCapabilities && template.llmType === 'fast') {
      issues.push('Complex capabilities detected but using fast LLM - consider thinking LLM');
    }

    // Check dependencies
    if (template.dependencies) {
      const requiredDeps = template.dependencies.filter(dep => dep.required);
      if (requiredDeps.length > 5) {
        issues.push('Too many required dependencies may cause integration issues');
      }
    }

    return {
      usable: issues.length === 0,
      issues
    };
  }

  /**
   * Get template statistics
   */
  getTemplateStatistics() {
    const stats = {
      totalTemplates: this.templates.size,
      categoryCounts: {},
      llmTypeCounts: { thinking: 0, fast: 0 },
      capabilityFrequency: {},
      averageComplexity: 0
    };

    // Count by category
    for (const [category, templateNames] of this.templatesByCategory.entries()) {
      stats.categoryCounts[category] = templateNames.length;
    }

    // Count by LLM type and analyze capabilities
    let totalComplexity = 0;
    for (const template of this.templates.values()) {
      stats.llmTypeCounts[template.llmType]++;
      
      // Count capability frequency
      for (const capability of template.capabilities) {
        stats.capabilityFrequency[capability] = 
          (stats.capabilityFrequency[capability] || 0) + 1;
      }

      // Calculate complexity (simple metric based on capabilities and deliverables)
      const complexity = template.capabilities.length + 
                        (template.deliverables.code?.length || 0) +
                        (template.deliverables.database?.length || 0) +
                        (template.deliverables.outputs?.length || 0);
      totalComplexity += complexity;
    }

    stats.averageComplexity = totalComplexity / this.templates.size;

    return stats;
  }

  /**
   * Save a new template to the templates directory
   */
  async saveTemplate(template) {
    // Validate template
    const structureValidation = this.validateTemplateStructure(template);
    if (!structureValidation.valid) {
      throw new Error(`Template validation failed: ${structureValidation.errors.join(', ')}`);
    }

    const usabilityValidation = this.validateTemplateUsability(template);
    if (!usabilityValidation.usable) {
      logger.warn(`Template usability issues: ${usabilityValidation.issues.join(', ')}`);
    }

    // Check for name conflicts
    if (this.templates.has(template.name)) {
      throw new Error(`Template with name '${template.name}' already exists`);
    }

    try {
      // Save to file
      const filename = `${template.name}.json`;
      const filePath = path.join(this.templatesDir, filename);
      await fs.writeFile(filePath, JSON.stringify(template, null, 2), 'utf8');

      // Add to memory
      this.templates.set(template.name, {
        ...template,
        filename,
        loadedAt: new Date().toISOString()
      });

      // Update category index
      const category = template.category || 'custom';
      if (!this.templatesByCategory.has(category)) {
        this.templatesByCategory.set(category, []);
      }
      this.templatesByCategory.get(category).push(template.name);

      logger.info(`Saved new template: ${template.name}`);
      return true;

    } catch (error) {
      logger.error(`Failed to save template ${template.name}:`, error);
      throw error;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateName) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    try {
      // Delete file
      const filePath = path.join(this.templatesDir, template.filename);
      await fs.unlink(filePath);

      // Remove from memory
      this.templates.delete(templateName);

      // Update category index
      const category = template.category || 'custom';
      if (this.templatesByCategory.has(category)) {
        const templates = this.templatesByCategory.get(category);
        const index = templates.indexOf(templateName);
        if (index > -1) {
          templates.splice(index, 1);
        }
        if (templates.length === 0) {
          this.templatesByCategory.delete(category);
        }
      }

      logger.info(`Deleted template: ${templateName}`);
      return true;

    } catch (error) {
      logger.error(`Failed to delete template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Get recommended templates based on requirements
   */
  getRecommendedTemplates(requirements) {
    const {
      task_type,
      data_sources,
      output_requirements,
      performance_needs,
      integration_requirements
    } = requirements;

    const recommendations = [];

    // Rule-based recommendations
    if (task_type === 'data_analysis' || task_type === 'reporting') {
      recommendations.push(this.getTemplate('analysis_agent'));
    }

    if (task_type === 'research' || task_type === 'investigation') {
      recommendations.push(this.getTemplate('research_agent'));
    }

    if (task_type === 'monitoring' || task_type === 'alerting') {
      recommendations.push(this.getTemplate('monitoring_agent'));
    }

    if (task_type === 'automation' || task_type === 'workflow') {
      recommendations.push(this.getTemplate('automation_agent'));
    }

    if (integration_requirements && integration_requirements.length > 0) {
      recommendations.push(this.getTemplate('integration_agent'));
    }

    // Filter out null/undefined recommendations
    return recommendations.filter(Boolean);
  }
}