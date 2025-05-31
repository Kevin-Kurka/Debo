// Documentation & Dependency Management Schema
export const documentationSchema = {
  dependency_documentation: {
    keyPattern: 'doc:{packageName}:{version}',
    fields: {
      packageName: 'string',
      version: 'string',
      documentation: 'text',
      bestPractices: 'json',
      compatibilityMatrix: 'json',
      deprecationStatus: 'active|deprecated|end_of_life',
      securityVulnerabilities: 'json',
      lastUpdated: 'timestamp',
      reviewStatus: 'pending|approved|rejected'
    },
    vectors: {
      documentation_embedding: 'vector[1536]',
      practices_embedding: 'vector[1536]'
    }
  },

  compatibility_checks: {
    keyPattern: 'compat:{projectId}:{packageName}',
    fields: {
      packageName: 'string',
      version: 'string',
      conflictingPackages: 'json',
      compatibilityScore: 'number',
      issues: 'json',
      resolutionPlan: 'text',
      status: 'compatible|conflicts|needs_review'
    }
  },

  deprecation_warnings: {
    keyPattern: 'deprecation:{packageName}',
    fields: {
      packageName: 'string',
      currentVersion: 'string',
      deprecatedSince: 'timestamp',
      endOfLifeDate: 'timestamp',
      replacementPackages: 'json',
      migrationPath: 'text'
    }
  }
};

export const dependencyAgentConfig = {
  dependency_analyst: {
    llmType: 'thinking',
    responsibilities: ['dependency_review', 'compatibility_analysis', 'documentation_indexing'],
    triggers: ['package_install_request', 'dependency_update', 'compatibility_conflict'],
    deliverables: {
      database: ['dependency_documentation', 'compatibility_checks', 'deprecation_warnings'],
      outputs: ['compatibility_report', 'migration_plan', 'documentation_index']
    },
    instructions: 'Review all new dependencies for compatibility, security, and deprecation status. Index documentation and extract best practices.'
  }
};
